/**
 * KnowledgeGraphPage — 知识点连线图（Obsidian 式）入口页。
 *
 * 全图一次性加载；点概念节点 → 右侧抽屉列出「谁在讲它」的反链清单
 * （节点讲解 / 微练习 / 术语 / 课程 / SQL 练习 / 流程节点），点流程节点类反链可跳工厂全景。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import type { KgNode } from '../../api/endpoints';
import { ForceGraphCanvas, KIND_LABEL } from './ForceGraphCanvas';

const DEFAULT_FLOW = 'generic-factory';

export function KnowledgeGraphPage() {
  const [selected, setSelected] = useState<KgNode | null>(null);

  const graph = useQuery({
    queryKey: ['knowledge-graph'],
    queryFn: () => api.knowledgeGraph(DEFAULT_FLOW),
  });

  const conceptKey = selected?.kind === 'concept' ? selected.id.split(':')[1] : null;
  const concept = useQuery({
    queryKey: ['knowledge-concept', conceptKey],
    enabled: !!conceptKey,
    queryFn: ({ signal }) => api.knowledgeGraphConcept(conceptKey as string, signal),
  });

  const onSelect = (n: KgNode) => setSelected(n);

  const close = () => setSelected(null);

  return (
    <div className="kg-page">
      <header className="kg-head">
        <div>
          <h1 className="kg-title">知识点连线图</h1>
          <p className="kg-sub">
            把散落在讲解、微练习、术语表、课程与 SQL 练习里的同一知识点自动聚成一簇。
            点绿色概念节点看它的反链，点节点可拖动。
          </p>
        </div>
        <ul className="kg-legend" aria-hidden>
          <li><span className="kg-dot kg-dot-concept" /> 概念</li>
          <li><span className="kg-dot kg-dot-node" /> 流程节点</li>
          <li><span className="kg-dot kg-dot-artifact" /> 知识工件</li>
        </ul>
      </header>

      <div className="kg-body">
        <div className="kg-canvas-col">
          {graph.isLoading && <div className="kg-loading">连线图加载中…</div>}
          {graph.isError && (
            <div className="kg-error">连线图加载失败：{(graph.error as Error).message}</div>
          )}
          {graph.data && (
            <ForceGraphCanvas
              nodes={graph.data.nodes}
              links={graph.data.links}
              focusId={selected?.id ?? null}
              onSelect={onSelect}
            />
          )}
        </div>

        {selected && (
          <aside className="kg-drawer" aria-label="节点详情">
            <button className="kg-drawer-close" onClick={close} aria-label="关闭">
              ×
            </button>
            <div className="kg-drawer-kind">{KIND_LABEL[selected.kind] ?? selected.kind}</div>
            <h2 className="kg-drawer-title">{selected.label}</h2>

            {selected.kind === 'concept' && (
              <>
                {concept.isLoading && <p className="kg-muted">反链加载中…</p>}
                {concept.data && (
                  <>
                    {concept.data.concept.definition && (
                      <p className="kg-def">{concept.data.concept.definition}</p>
                    )}
                    <h3 className="kg-backlink-h">谁在讲它（{concept.data.backlinks.length}）</h3>
                    {concept.data.backlinks.length === 0 && (
                      <p className="kg-muted">暂无指认的工件。</p>
                    )}
                    <ul className="kg-backlinks">
                      {concept.data.backlinks.map((b, i) => (
                        <li key={`${b.kind}-${b.refId}-${i}`} className="kg-backlink">
                          <span className="kg-backlink-kind">{KIND_LABEL[b.kind] ?? b.kind}</span>
                          {b.nodeKey ? (
                            <Link className="kg-backlink-link" to={`/factory?node=${encodeURIComponent(b.nodeKey)}`}>
                              {b.title}
                            </Link>
                          ) : (
                            <span className="kg-backlink-title">{b.title}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {selected.kind === 'node' && (
              <p className="kg-muted">
                这是工厂过程里的一个环节。相关概念已用虚线连到它身上——点概念节点看详解。
              </p>
            )}

            {selected.kind !== 'concept' && selected.kind !== 'node' && (
              <p className="kg-muted">这是一个知识工件，已连到它所属的概念节点。</p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
