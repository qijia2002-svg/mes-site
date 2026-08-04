/**
 * 桌面矩阵（UIUX §3.4 / §4.2）。列 = 能力路线，行 = 成长阶段，等级递进 = 垂直直线。
 *
 * 连线层是一张覆盖全矩阵的绝对定位 SVG：`pointer-events:none` + `aria-hidden`，
 * 坐标靠 `useLayoutEffect` 一次批量测量得到（**不在 render 里同步读布局**，
 * 逐节点读 rect 会把每个节点变成一次强制回流）。
 * 手机断点由上层判断后整段不挂载本组件，这里不做 CSS 隐藏。
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import type { CareerStage } from '../../api/roadmap';
import { RoadmapNode } from './RoadmapNode';
import { StageDetail } from './StageDetail';
import { trackIcon } from './trackIcons';
import { stageIndexLabel } from './roadmapLabels';
import { buildEdgeGeoms, cellKey, type NodeRect, type RoadmapMatrix as Matrix } from './roadmapLayout';

function sameRects(a: Record<string, NodeRect>, b: Record<string, NodeRect>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => {
    const x = a[k];
    const y = b[k];
    return y && x.x === y.x && x.y === y.y && x.w === y.w && x.h === y.h;
  });
}

export function RoadmapMatrix({
  matrix,
  stageMap,
}: {
  matrix: Matrix;
  stageMap: Map<number, CareerStage>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Record<string, NodeRect>>({});

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const next: Record<string, NodeRect> = {};
      wrap.querySelectorAll<HTMLElement>('[data-node-id]').forEach((el) => {
        const id = el.dataset.nodeId;
        if (!id) return;
        const r = el.getBoundingClientRect();
        next[id] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      });
      setRects((prev) => (sameRects(prev, next) ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [matrix]);

  const edges = useMemo(
    () => buildEdgeGeoms(matrix, rects, matrix.currentId),
    [matrix, rects],
  );

  const gridStyle = { '--rm-cols': matrix.columns.length } as CSSProperties;

  return (
    <div className="rm-scroll">
      <div className="rm-matrix" ref={wrapRef} style={gridStyle}>
        <div className="rm-row rm-row-head">
          <div className="rm-stage-cell" />
          {matrix.columns.map((col) => (
            <Link key={col.slug} className="rm-col-head" to={`/tracks/${col.slug}`}>
              <Icon name={trackIcon(col.slug, col.icon)} size={20} className="rm-col-glyph" />
              <span className="rm-col-title">{col.title}</span>
            </Link>
          ))}
        </div>

        <div className="rm-rows" role="list">
          {matrix.stages.map((row) => (
            <div
              key={row.node.id}
              className="rm-row-group"
              role="listitem"
              aria-label={`阶段 ${stageIndexLabel(row.index)} ${row.node.title}，${row.total} 个节点，已完成 ${row.done} 个`}
            >
              <div className="rm-row">
                <div className="rm-stage-cell">
                  <span className="rm-stage-index">{stageIndexLabel(row.index)}</span>
                  <span className="rm-stage-title">{row.node.title}</span>
                  {row.node.goal && <span className="rm-stage-goal">{row.node.goal}</span>}
                  <span className="rm-stage-count">
                    {row.done}/{row.total}
                    {row.node.duration && ` · ${row.node.duration}`}
                  </span>
                </div>
                {matrix.columns.map((col) => {
                  const cell = matrix.cells.get(cellKey(row.index, col.slug));
                  // 空单元格留空：矩阵的空白本身就是信息（这条线这个阶段不要求）
                  if (!cell) return <div key={col.slug} className="rm-cell-empty" />;
                  return (
                    <RoadmapNode
                      key={col.slug}
                      placed={cell}
                      isCurrent={cell.node.id === matrix.currentId}
                    />
                  );
                })}
              </div>
              <StageDetail stage={stageMap.get(row.node.stage)} />
            </div>
          ))}
        </div>

        <svg className="rm-edges" aria-hidden="true" focusable="false">
          {edges.map((edge) => (
            <g key={edge.id} className={edge.isCurrent ? 'rm-edge is-here' : `rm-edge is-${edge.importance}`}>
              <path
                d={edge.d}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <polygon points={edge.arrow} />
            </g>
          ))}
        </svg>
      </div>

      <p className="rm-scroll-hint">屏幕放不下全部列，矩阵可以左右滚动查看。</p>

      {matrix.overflowColumns.length > 0 && (
        <p className="rm-overflow">
          <Icon name="info" size={16} className="rm-overflow-glyph" />
          另有 {matrix.overflowColumns.length} 条选修路线未画进矩阵（列数上限 6，先保证核心线看得清）：
          {matrix.overflowColumns.map((col) => (
            <Link key={col.slug} className="text-link" to={`/tracks/${col.slug}`}>
              {col.title}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
