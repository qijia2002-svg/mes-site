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
 *
 * 层 4 的「同屏内联」分档（A 方案第 1 步，按组件重量分，不是一刀切）：
 *   micro      抽屉内内联，判分即完成
 *   quiz / sql 抽屉内**就地展开**，复用 QuizDeck / SqlSandbox 内核，不跳页
 *   sim        全屏接管（画布 + 元件 + 属性 + 日志塞不进 420px），带 ?from= 回链
 * 只有 sql 展开时才请求抽屉展宽——测验在窄抽屉里本来就够用，不必抖动布局。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import { SYSTEMS, SYSTEM_HINTS, practicesOf, type LaidNode } from './factoryFlow.data';
import { oneLinerOf } from './factoryStages.data';
import { NODE_RESOURCE_DONE } from './useNodeProgress';
import MicroPractice from './MicroPractice';
import InlinePractice from './InlinePractice';

/** 资源类型 → 图标与目标路由。micro 不在此表：它内联判分，不跳页。 */
const RES_META: Record<string, { icon: IconName; to: (id: number) => string; kind: string }> = {
  chapter: { icon: 'chapter', to: (id) => `/chapters/${id}`, kind: '知识' },
  sql: { icon: 'sql', to: (id) => `/sql-space/${id}`, kind: 'SQL 实战' },
  quiz: { icon: 'quiz', to: (id) => `/quiz/q/${id}`, kind: '随堂测验' },
  sim: { icon: 'routing', to: () => '/simulator', kind: '产线搭建' },
};

/** 能在抽屉里就地展开的类型。sim 不在其列：它需要全屏画布。 */
const INLINE_TYPES = new Set(['sql', 'quiz']);

const SYS_BY_ID = new Map(SYSTEMS.map((s) => [s.id.toUpperCase(), s]));

export interface NodeDrawerBodyProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
  /** 请求抽屉展宽（仅 SQL 展开时为 true）。父级据此切 .is-wide。 */
  onWideChange?: (wide: boolean) => void;
}

export default function NodeDrawerBody({
  node, resources, isDone, onWideChange,
}: NodeDrawerBodyProps) {
  const sorted = [...resources].sort((a, b) => a.sort - b.sort);
  const chapters = sorted.filter((r) => r.type === 'chapter');
  const practices = practicesOf(sorted);
  const doneCount = practices.filter((r) => isDone(r.type, r.refId)).length;

  const hints = SYSTEM_HINTS[node.key] ?? [];
  const systems = hints.map((h) => SYS_BY_ID.get(h)).filter((s) => s !== undefined);
  const otherOwners = hints.filter((h) => !SYS_BY_ID.has(h));
  const lede = oneLinerOf(node);

  /** 当前就地展开的实战（`${type}:${refId}`）。同一时刻只开一个，避免抽屉变成长卷轴。 */
  const [openKey, setOpenKey] = useState<string | null>(null);

  // 只有 SQL 要展宽：编辑器 + 结果表在 420px 里没法看。测验窄着就够，不折腾布局。
  useEffect(() => {
    onWideChange?.(openKey?.startsWith('sql:') ?? false);
  }, [openKey, onWideChange]);

  // 抽屉关闭/换节点卸载时必须复位，否则宽态会残留到下一次打开。
  useEffect(() => () => onWideChange?.(false), [onWideChange]);

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
            const key = `${r.type}:${r.refId}`;

            // quiz / sql：就地展开，不离开工厂全景。
            if (INLINE_TYPES.has(r.type)) {
              const open = openKey === key;
              return (
                <div key={key} className={`nd-fold${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className={`nd-drill${done ? ' is-done' : ''}`}
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : key)}
                  >
                    <span className="nd-di"><Icon name={meta.icon} size={20} /></span>
                    <span className="nd-dtx">
                      <span className="nd-dl">{r.title}</span>
                      <span className="nd-dk">{open ? '收起' : meta.kind}</span>
                    </span>
                    <span className="nd-dgo">
                      <Icon
                        name={done ? 'check-circle' : open ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        label={done ? '已完成' : undefined}
                      />
                    </span>
                  </button>
                  {open && (
                    <div className="nd-inline">
                      <InlinePractice type={r.type as 'sql' | 'quiz'} refId={r.refId} />
                    </div>
                  )}
                </div>
              );
            }

            // sim：全屏接管，带上来源节点，落地页可据此回链。
            return (
              <Link
                key={key}
                to={`${meta.to(r.refId)}?from=${encodeURIComponent(node.key)}`}
                className={`nd-drill${done ? ' is-done' : ''}`}
              >
                <span className="nd-di"><Icon name={meta.icon} size={20} /></span>
                <span className="nd-dtx">
                  <span className="nd-dl">{r.title}</span>
                  <span className="nd-dk">{meta.kind} · 全屏打开</span>
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
