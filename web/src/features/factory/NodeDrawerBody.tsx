/**
 * 抽屉正文 · 初学者线性学习流（Zero-baseline v3 重构）。
 *
 * 结构（对应产品 brief「动机 → 学 → 测 → 练 → 上手」）：
 *   [非步骤] 动机前置横幅 —— 不学的代价 / 学完能干什么，只作动机，**不拦截**。
 *   第一步   知识卡（KnowledgeCard，按块渲染）
 *   第二步   自测题（BeginnerQuiz，全对派发 solve('quiz', node.id)）
 *   第三步   微练习（filter resources type==='micro'，各用自己 ref_id 落键；
 *            答错后由 MicroPractice 按需拉分级提示，从不预拉）
 *   第四步   SQL 案例（BeginnerSqlLab，参考解答默认折叠）
 *   [折叠]   进阶详解（api.nodeExplainers(node.id,'detail')，展开时懒加载，空数组降级）
 *
 * 进度沿用既有 NODE_RESOURCE_DONE 事件，落 factory.progress（仅本地 KV 镜像）。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { api, type NodeResourceDTO, type NodeExplainerDTO } from '../../api/endpoints';
import type { LaidNode } from './factoryFlow.data';
import { oneLinerOf } from './factoryStages.data';
import { NODE_RESOURCE_DONE } from './useNodeProgress';
import { beginnerPathOf } from './beginnerPath.data';
import { BeginnerSqlLab } from './BeginnerSqlLab';
import { BeginnerQuiz } from './BeginnerQuiz';
import KnowledgeCard from './KnowledgeCard';
import MicroPractice from './MicroPractice';
import { renderChapterMarkdown } from '../../lib/markdown';

export interface NodeDrawerBodyProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
  /** 请求抽屉展宽（仅 SQL 步骤为 true）。父级据此切 .is-wide。 */
  onWideChange?: (wide: boolean) => void;
}

/**
 * 进阶详解：展开时懒加载该节点的 node_explainers（detail 层级）。
 * 生产 D1 当前为 0 行——空数组须优雅降级（不渲染折叠区内容，给一句引导），
 * 不能假定一定有数据，更不能让加载态卡死。
 */
function DeepDive({ nodeId }: { nodeId: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NodeExplainerDTO[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!open || items !== null) return;
    let alive = true;
    api.nodeExplainers(nodeId, 'detail')
      .then((r) => { if (alive) setItems(r.items ?? []); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [open, items, nodeId]);

  return (
    <details className="nd-deep" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="nd-deep-s">
        <Icon name="deep-dive" size={16} className="inline-glyph" />
        <span className="caps">进阶详解</span>
      </summary>
      {open && (
        <div className="nd-deep-b">
          {err && (
            <p className="nd-deep-empty">进阶详解暂时取不出来（内容还在播种中），先把上面四步练完。</p>
          )}
          {!err && items === null && <p className="nd-deep-empty">加载中…</p>}
          {!err && items !== null && items.length === 0 && (
            <p className="nd-deep-empty">这一节还没有进阶详解，先把上面四步练完。</p>
          )}
          {!err && items !== null && items.length > 0 && (
            items.map((it) => {
              const { html } = renderChapterMarkdown(it.bodyMd);
              return (
                <article key={it.id} className="nd-deep-item">
                  <h4 className="nd-deep-t">{it.title}</h4>
                  <div className="nd-deep-md prose" dangerouslySetInnerHTML={{ __html: html }} />
                </article>
              );
            })
          )}
        </div>
      )}
    </details>
  );
}

export default function NodeDrawerBody({
  node, resources, isDone, onWideChange,
}: NodeDrawerBodyProps) {
  const path = beginnerPathOf(node.key);
  const chapters = [...resources].filter((r) => r.type === 'chapter');
  const micros = [...resources].filter((r) => r.type === 'micro');
  const lede = oneLinerOf(node);
  const [sqlOpen, setSqlOpen] = useState(false);

  // SQL 步骤需要更宽的空间（编辑器 + 结果表）。
  useEffect(() => { onWideChange?.(sqlOpen); }, [sqlOpen, onWideChange]);
  useEffect(() => () => onWideChange?.(false), [onWideChange]);

  /** 完成某类实战 → 派发事件，useNodeProgress 监听落进度。refId 用节点/资源各自 id 区分。 */
  const solve = (type: string, refId: number) => {
    window.dispatchEvent(
      new CustomEvent(NODE_RESOURCE_DONE, { detail: { type, refId } }),
    );
  };

  if (!path) {
    return (
      <div className="nd-body">
        <p className="nd-know">这个环节暂未准备初学者内容，先往后走，上线后会出现在这里。</p>
      </div>
    );
  }

  return (
    <div className="nd-body">
      {lede && <p className="nd-lede">{lede}</p>}

      {/* [非步骤] 动机前置：只作动机，不拦截 */}
      {path.motivation && (
        <section className="nd-moti" aria-label="为什么学这一节">
          <div className="nd-moti-row">
            <span className="nd-moti-ic nd-moti-ic-pain"><Icon name="warn" size={16} /></span>
            <p className="nd-moti-tx">
              <span className="caps nd-moti-k">不学的代价</span>
              {path.motivation.pain}
            </p>
          </div>
          <div className="nd-moti-row">
            <span className="nd-moti-ic nd-moti-ic-gain"><Icon name="success" size={16} /></span>
            <p className="nd-moti-tx">
              <span className="caps nd-moti-k">学完能做成</span>
              {path.motivation.gain}
            </p>
          </div>
        </section>
      )}

      {/* 第一步：初级知识卡 */}
      <section className="nd-sec">
        <div className="nd-sec-h">
          <Icon name="hint" size={16} className="inline-glyph" />
          <span className="caps">第一步 · 先搞懂</span>
        </div>
        <KnowledgeCard blocks={path.knowledge} />
        <p className="nd-know nd-know-soft">这一步会落到：{path.systems}。</p>
        {chapters.length > 0 && (
          <Link to={`/chapters/${chapters[0].refId}`} className="text-link" style={{ fontSize: 'var(--text-xs)' }}>
            想深入看完整章节 →
          </Link>
        )}
      </section>

      {/* 第二步：自测题 */}
      <section className="nd-sec">
        <div className="nd-sec-h">
          <Icon name="quiz" size={16} className="inline-glyph" />
          <span className="caps">第二步 · 测一下懂没懂</span>
        </div>
        <BeginnerQuiz questions={path.quiz} onAllCorrect={() => solve('quiz', node.id)} />
      </section>

      {/* 第三步：微练习（SQL 前台阶，计入完成度） */}
      <section className="nd-sec">
        <div className="nd-sec-h">
          <Icon name="mapping" size={16} className="inline-glyph" />
          <span className="caps">第三步 · 动手练一练</span>
        </div>
        {micros.length === 0 ? (
          <p className="nd-know nd-know-soft">这一节的微练习还在播种中，先做旁边的自测和 SQL。</p>
        ) : (
          <div className="nd-micros">
            {micros.map((m) => (
              <MicroPractice
                key={m.refId}
                id={m.refId}
                title={m.title}
                done={isDone('micro', m.refId)}
                onSolved={() => solve('micro', m.refId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 第四步：SQL 案例练习 */}
      <section className="nd-sec">
        <div className="nd-sec-h">
          <Icon name="sql" size={16} className="inline-glyph" />
          <span className="caps">第四步 · 上手写 SQL</span>
        </div>
        <BeginnerSqlLab
          sqlCase={path.sql}
          onPass={() => { setSqlOpen(true); solve('sql', node.id); }}
        />
      </section>

      {/* 进阶详解（折叠，展开时懒加载；空数组优雅降级） */}
      <DeepDive nodeId={node.id} />
    </div>
  );
}
