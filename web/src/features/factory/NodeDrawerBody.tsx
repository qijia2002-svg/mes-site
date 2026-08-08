/**
 * 抽屉正文的四层渐进披露（SPEC §5 / UIUX §3）。层序不可调：
 *
 *   1 一句话   node.one_liner —— 大白话，一行说清这一环在干什么
 *   2 知识     现有 chapter 资源，读物永不进完成度分母（ADR-017）
 *   3 系统对应 「车间动作 ↔ 系统记录」对照块
 *   4 实战     quiz / sql / sim / micro；micro 内联判分，不跳页
 *
 * 第 3 层为什么叫 mapping 不叫 analogy：ADR-021 已删 analogy 槽位。
 * 用户裁决「不要比喻」——不写「工厂像餐厅」，只写车间里真实发生的动作
 * 对应到系统里真实落的那条记录。具象化靠真实数据，不靠打比方。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import { SYSTEMS, SYSTEM_HINTS, practicesOf, type LaidNode } from './factoryFlow.data';
import { oneLinerOf } from './factoryStages.data';
import { NODE_RESOURCE_DONE } from './useNodeProgress';
import MicroPractice from './MicroPractice';

/** 资源类型 → 图标与目标路由。micro 不在此表：它内联判分，不跳页。 */
const RES_META: Record<string, { icon: IconName; to: (id: number) => string; kind: string }> = {
  chapter: { icon: 'chapter', to: (id) => `/chapters/${id}`, kind: '知识' },
  sql: { icon: 'sql', to: (id) => `/sql-space/${id}`, kind: 'SQL 实战' },
  quiz: { icon: 'quiz', to: (id) => `/quiz/q/${id}`, kind: '随堂测验' },
  sim: { icon: 'routing', to: () => '/simulator', kind: '产线搭建' },
};

const SYS_BY_ID = new Map(SYSTEMS.map((s) => [s.id.toUpperCase(), s]));

export interface NodeDrawerBodyProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
}

export default function NodeDrawerBody({ node, resources, isDone }: NodeDrawerBodyProps) {
  const sorted = [...resources].sort((a, b) => a.sort - b.sort);
  const chapters = sorted.filter((r) => r.type === 'chapter');
  const practices = practicesOf(sorted);
  const doneCount = practices.filter((r) => isDone(r.type, r.refId)).length;

  const hints = SYSTEM_HINTS[node.key] ?? [];
  const systems = hints.map((h) => SYS_BY_ID.get(h)).filter((s) => s !== undefined);
  const otherOwners = hints.filter((h) => !SYS_BY_ID.has(h));
  const lede = oneLinerOf(node);

  /** micro 判分通过 → 派发完成事件，useNodeProgress 监听落进度（目标页无需感知工厂流）。 */
  const solve = (refId: number) => {
    window.dispatchEvent(
      new CustomEvent(NODE_RESOURCE_DONE, { detail: { type: 'micro', refId } }),
    );
  };

  return (
    <div className="nd-body">
      {/* ── 层 1：一句话 ── */}
      {lede && <p className="nd-lede">{lede}</p>}

      {/* ── 层 2：知识 ── */}
      <section className="nd-sec">
        <div className="nd-sec-h"><span className="caps">这一环在干什么</span></div>
        <p className="nd-know">{node.description}</p>
        {chapters.map((r) => {
          const done = isDone(r.type, r.refId);
          return (
            <Link
              key={`${r.type}:${r.refId}`}
              to={RES_META.chapter.to(r.refId)}
              className={`nd-drill${done ? ' is-done' : ''}`}
            >
              <span className="nd-di"><Icon name="chapter" size={20} /></span>
              <span className="nd-dtx">
                <span className="nd-dl">{r.title}</span>
                <span className="nd-dk">知识 · 读完不计完成度</span>
              </span>
              <span className="nd-dgo">
                <Icon
                  name={done ? 'check-circle' : 'chevron-right'}
                  size={16}
                  label={done ? '已读' : undefined}
                />
              </span>
            </Link>
          );
        })}
      </section>

      {/* ── 层 3：车间动作 ↔ 系统记录 ── */}
      {hints.length > 0 && (
        <section className="nd-sec">
          <div className="nd-sec-h">
            <span className="caps">车间动作 ↔ 系统记录</span>
          </div>
          <div className="nd-map">
            <div className="nd-map-row">
              <span className="nd-map-k">车间里</span>
              <span className="nd-map-v">{lede || node.description}</span>
            </div>
            <div className="nd-map-arrow" aria-hidden="true">
              <Icon name="mapping" size={16} />
            </div>
            <div className="nd-map-row">
              <span className="nd-map-k">系统里</span>
              <span className="nd-map-v">
                {systems.length > 0
                  ? '这一步落进下面这些系统的记录里'
                  : otherOwners.join(' · ')}
              </span>
            </div>
          </div>

          {systems.map((s) => (
            <details key={s.id} className="nd-dive">
              <summary>
                <span className="nd-dive-ic"><Icon name={s.icon} size={16} /></span>
                <span className="nd-dive-t">
                  想深入：{s.name}到底管什么？
                </span>
                <span className="nd-dive-ch"><Icon name="deep-dive" size={16} /></span>
              </summary>
              <p className="nd-dive-b">
                <strong>{s.role}</strong>
                <span>{s.body}</span>
              </p>
            </details>
          ))}

          {systems.length > 0 && otherOwners.length > 0 && (
            <div className="nd-chips">
              {otherOwners.map((o) => <span key={o} className="nd-chip">{o}</span>)}
            </div>
          )}
        </section>
      )}

      {/* ── 层 4：实战 ── */}
      <section className="nd-sec">
        <div className="nd-sec-h">
          <span className="caps">在这里动手练</span>
          {practices.length > 0 && (
            <span className="nd-count tabular">{doneCount} / {practices.length}</span>
          )}
        </div>
        {practices.length === 0 ? (
          <p className="nd-know">这个环节暂未挂练习，先往后走，上线后会出现在这里。</p>
        ) : (
          practices.map((r) => {
            const done = isDone(r.type, r.refId);
            if (r.type === 'micro') {
              return (
                <MicroPractice
                  key={`micro:${r.refId}`}
                  id={r.refId}
                  title={r.title}
                  done={done}
                  onSolved={() => solve(r.refId)}
                />
              );
            }
            const meta = RES_META[r.type] ?? RES_META.chapter;
            return (
              <Link
                key={`${r.type}:${r.refId}`}
                to={meta.to(r.refId)}
                className={`nd-drill${done ? ' is-done' : ''}`}
              >
                <span className="nd-di"><Icon name={meta.icon} size={20} /></span>
                <span className="nd-dtx">
                  <span className="nd-dl">{r.title}</span>
                  <span className="nd-dk">{meta.kind}</span>
                </span>
                <span className="nd-dgo">
                  <Icon
                    name={done ? 'check-circle' : 'chevron-right'}
                    size={16}
                    label={done ? '已完成' : undefined}
                  />
                </span>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
