/**
 * 手机端纵向阶梯（UIUX §3.5）。不是"缩小的矩阵"，是换一套信息结构：
 *  - 列（路线）消失 → 路线名进节点行内
 *  - 行（阶段）变 accordion，默认只展开第一个未完成阶段
 *  - SVG 连线整段不挂载 → 重要度改由竖轴标记 + 文字 pill 两条通道承载
 *
 * 竖轴标记与矩阵里的角标同形（实心方 / 空心方 / 虚线圆），换了布局但没换语汇。
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { CareerStage } from '../../api/roadmap';
import { RoadmapNode } from './RoadmapNode';
import { StageDetail } from './StageDetail';
import { stageIndexLabel } from './roadmapLabels';
import { cellKey, defaultOpenStage, type RoadmapMatrix as Matrix } from './roadmapLayout';
import { prefersReducedMotion } from './useIsNarrow';

export function RoadmapStair({
  matrix,
  stageMap,
}: {
  matrix: Matrix;
  stageMap: Map<number, CareerStage>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState(() => defaultOpenStage(matrix.stages));

  // 换岗位后阶段结构全变，展开位置要跟着重算，不能留在上一个岗位的下标上
  useEffect(() => {
    setOpenIndex(defaultOpenStage(matrix.stages));
  }, [matrix]);

  // 「你在这里」自动定位。scrollIntoView 是 JS 行为，全局 reduced-motion 兜底管不着
  useEffect(() => {
    const id = matrix.currentId;
    if (!id) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [matrix.currentId, openIndex]);

  return (
    <div className="rm-stairs" ref={rootRef} role="list">
      {matrix.stages.map((row) => {
        const open = openIndex === row.index;
        const cells = matrix.columns
          .map((col) => matrix.cells.get(cellKey(row.index, col.slug)))
          .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));

        return (
          <details
            key={row.node.id}
            className="rm-stage"
            role="listitem"
            open={open}
            aria-label={`阶段 ${stageIndexLabel(row.index)} ${row.node.title}，${row.total} 个节点，已完成 ${row.done} 个`}
          >
            <summary
              className="rm-stage-summary"
              onClick={(event) => {
                event.preventDefault();
                setOpenIndex(open ? -1 : row.index);
              }}
            >
              <Icon
                name={open ? 'chevron-down' : 'chevron-right'}
                size={16}
                className="rm-stage-arrow"
              />
              <span className="rm-stage-index">{stageIndexLabel(row.index)}</span>
              <span className="rm-stage-title">{row.node.title}</span>
              <span className="rm-stage-count">
                {row.done}/{row.total}
              </span>
            </summary>

            <div className="rm-stage-body">
              {row.node.goal && <p className="rm-stage-goal">{row.node.goal}</p>}
              {cells.length === 0 ? (
                <p className="rm-stage-goal">这个阶段没有新增能力要求，把上一阶段的欠账补齐。</p>
              ) : (
                <ul className="rm-stair">
                  {cells.map((cell) => (
                    <li key={cell.node.id} className={`rm-stair-item is-${cell.importance}`}>
                      <span className={`rm-mark is-${cell.importance}`} aria-hidden="true" />
                      <RoadmapNode
                        placed={cell}
                        isCurrent={cell.node.id === matrix.currentId}
                        variant="stair"
                      />
                    </li>
                  ))}
                </ul>
              )}
              <StageDetail stage={stageMap.get(row.node.stage)} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
