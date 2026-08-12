/**
 * /factory —— 只干一件事：工厂全景。
 *
 * v13 拆掉了双层 Tab（模式 全景/搭建 + 视图 全景/课程/路径/职业）与课程仪表盘：
 *  · 搭建 → 恢复独立路由 /simulator
 *  · 课程 / 路径 / 职业 → /courses、/learning-paths、/roadmap 各自独立成页
 *  · 续学 CTA 浓缩成头部「继续：{节点名}」——指的是工厂环节，不是课程（factory-first）
 *
 * 本文件只做壳与编排：拉数据 → 派生状态 → 交给 FactoryHeader / FactoryFlow / FactoryExtras。
 * 选中节点同步在 ?node=<key> 上，抽屉的开合就是 URL 的开合。
 */
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';
import type { FlowNodeDTO, FlowStageDTO, NodeResourceDTO } from '../api/endpoints';
import FactoryFlow from '../features/factory/FactoryFlow';
import FactoryJourney from '../features/factory/FactoryJourney';
import FactoryExtras from '../features/factory/FactoryExtras';
import SystemMap from '../features/factory/SystemMap';
import { DEFAULT_FLOW, PHASE_BY_KEY, buildSteps, type LaidNode, type Phase } from '../features/factory/factoryFlow.data';
import { useNodeProgress } from '../features/factory/useNodeProgress';
import { useNodeStatus, type NodeStatusApi } from '../features/factory/useNodeStatus';
import { useStageProgress } from '../features/factory/useStageProgress';
import MainlineStepper from '../features/factory/MainlineStepper';
import { DEFAULT_STAGES } from '../features/factory/factoryStages.data';
import { useIsNarrow } from '../features/roadmap/useIsNarrow';

const SLUG = 'generic-factory';

// ═══ 页头：工厂身份 + 一个动作 + 一条双层进度 ═══
function FactoryHeader({ title, total, status, nextNode, onResume }: {
  title: string;
  total: number;
  status: NodeStatusApi;
  nextNode: LaidNode | null;
  onResume: () => void;
}) {
  const { practicedCount, touchedCount, practicableTotal } = status;
  const pct = practicableTotal > 0 ? (practicedCount / practicableTotal) * 100 : 0;

  return (
    <>
      <style>{`
        /* 工厂页头部：复用课程页 .page-head/.page-title 视觉语言，仅保留本页独有的
           kicker 与进度卡样式，其余一律走共享 token（.card/.pill/.btn）。 */
        .fh-kicker{display:flex;align-items:center;gap:var(--space-2);color:var(--meta);
          margin:0 0 var(--space-2);font-size:var(--text-sm)}
        .fh-prog{margin-top:var(--space-5);padding:var(--space-4) var(--space-5);
          background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)}
        .fh-prog-head{display:flex;align-items:baseline;gap:var(--space-3);flex-wrap:wrap}
        .fh-prog-num{font-size:var(--text-lg);font-weight:var(--weight-announce-cjk)}
        .fh-prog-num em{font-style:normal;color:var(--meta);font-weight:var(--weight-read);
          font-size:var(--text-sm)}
        .fh-prog-note{font-size:var(--text-sm);color:var(--muted)}
        .fh-bar{margin-top:var(--space-3);height:6px;border-radius:var(--radius-pill);
          background:var(--progress-track);overflow:hidden}
        .fh-bar i{display:block;height:100%;border-radius:var(--radius-pill);
          background:var(--progress-fill);transition:width var(--motion-slow) var(--ease-standard)}
        .fh-sub{margin-top:var(--space-2);font-size:var(--text-xs);color:var(--meta)}
        @media(max-width:720px){
          /* 手机端进度卡压缩，让旅程节点更快进入首屏。 */
          .fh-prog{margin-top:var(--space-4);padding:var(--space-3) var(--space-4)}
          .fh-prog-num{font-size:var(--text-base)}
          .fh-bar{margin-top:var(--space-2);height:4px}
        }
      `}</style>

      <header className="page-head fh-head">
        <div>
          <p className="fh-kicker">
            <Icon name="factory" size={16} />
            <span className="caps">Factory Panorama</span>
          </p>
          <h1 className="page-title">{title} · 全景</h1>
          <p className="page-sub">
            <span className="pill pill-ok" style={{ marginRight: 'var(--space-2)' }}>L1 实操</span>
            从客户下单到发货出库的 {total} 个真实环节。点任意环节，看它管什么、归哪套系统，就地动手练。
          </p>
        </div>
        <div className="page-head-actions">
          {nextNode ? (
            <button type="button" className="btn btn-primary" onClick={onResume}>
              <Icon name="arrow-right" size={16} />
              {status.practicedCount === 0 ? '从这里开始' : '从这里继续'}：{nextNode.label}
            </button>
          ) : (
            <span className="btn btn-secondary" aria-live="polite">
              <Icon name="check-circle" size={16} />
              全部环节都练过了
            </span>
          )}
        </div>
      </header>

      <div className="card fh-prog">
        {practicableTotal > 0 ? (
          <>
            <div className="fh-prog-head">
              <span className="fh-prog-num tabular">
                已练 {practicedCount} / {practicableTotal} <em>个环节</em>
              </span>
              <span className="fh-prog-note">练过 = 在这个环节做完了 SQL 或测验，只看不算</span>
            </div>
            <div className="fh-bar"><i style={{ width: `${pct}%` }} /></div>
          </>
        ) : (
          <div className="fh-prog-head">
            <span className="fh-prog-num tabular">共 {total} 个环节 <em>· 内容陆续上线</em></span>
          </div>
        )}
        <div className="fh-sub tabular">已了解 {touchedCount} / {total} 个环节（读过知识卡也算）</div>
      </div>
    </>
  );
}

// ═══ 主壳 ═══
export default function FactoryPage() {
  const q = useQuery({
    queryKey: ['flowchart', SLUG],
    queryFn: () => api.flowchart(SLUG),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { isDone } = useNodeProgress(SLUG);
  const [sp, setSp] = useSearchParams();

  // 后端无数据 / 出错 → 兜底工厂流，页面永远画得出来。
  const flow = q.data && q.data.nodes?.length ? q.data : DEFAULT_FLOW;

  const resourcesByNode = useMemo(() => {
    const m = new Map<number, NodeResourceDTO[]>();
    for (const r of flow.resources ?? []) {
      const arr = m.get(r.nodeId) ?? [];
      arr.push(r);
      m.set(r.nodeId, arr);
    }
    return m;
  }, [flow.resources]);

  // 拓扑分层（mrp → purchase / bom-route 是真并行），拍平即流程顺序。
  const nodes = useMemo(() => {
    const raw = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
    const laid: LaidNode[] = raw.map((n) => ({
      ...n,
      phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase,
    }));
    return buildSteps(laid, flow.edges).flat();
  }, [flow.nodes, flow.edges]);

  const status = useNodeStatus(nodes, resourcesByNode, isDone);

  // 6 站主线进度（BLOCK-03：站点内先找没练完的，站内全练完才跨站）。
  // 后端未下发 stages 时回落静态 DEFAULT_STAGES；节点 stage_key 由 stageKeyOf 静态兜底，
  // 因此迁移前也能呈现 6 站骨架，迁移后无缝切换到后端数据（BLOCK-04 中间态）。
  const stages: FlowStageDTO[] = q.data?.stages && q.data.stages.length ? q.data.stages : DEFAULT_STAGES;
  const stageProgress = useStageProgress(stages, nodes, resourcesByNode, isDone);

  const selectedKey = sp.get('node');

  // 双模式：窄屏默认「旅程」（竖向单手浏览），宽屏默认「全景」（四泳道）。用户可随时切换。
  const [view, setView] = useState<'journey' | 'panorama'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'journey' : 'panorama',
  );
  // 手机端（≤767px）强制走竖向旅程，并隐藏「旅程/全景」切换开关——
  // 杜绝在窄屏误入四泳道「桌面网页」全景（用户已反馈此问题）。桌面端切换逻辑不变。
  const narrow = useIsNarrow();
  const effectiveView = narrow ? 'journey' : view;
  const select = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(sp);
      if (key) next.set('node', key);
      else next.delete('node');
      // 从「没开」到「开」推一条历史，移动端返回键即可关抽屉；切换与关闭只替换。
      setSp(next, { replace: key === null || sp.has('node') });
    },
    [sp, setSp],
  );

  const nextNode = useMemo(
    () => {
      // 主 CTA 必须绑 stageNextKey（BLOCK-03），跨站前先走完当前站。
      const key = stageProgress.stageNextKey ?? status.nextKey;
      return key ? nodes.find((n) => n.key === key) ?? null : null;
    },
    [nodes, stageProgress.stageNextKey, status.nextKey],
  );

  if (q.isLoading) return <LoadingState label="加载工厂全景…" />;

  return (
    <section style={{ maxWidth: 'var(--container-app)', margin: '0 auto' }}>
      <FactoryHeader
        title={q.data?.flow?.title ?? '通用离散制造厂'}
        total={nodes.length}
        status={status}
        nextNode={nextNode}
        onResume={() => nextNode && select(nextNode.key)}
      />
      {stageProgress.enabled && (
        <MainlineStepper stages={stageProgress.stages} onGoto={select} />
      )}

      <SystemMap />

      {!narrow && (<div className="ff-viewbar">
        <style>{`
          .ff-viewbar{display:flex;align-items:center;gap:var(--space-3);margin:0 0 var(--space-5);
            flex-wrap:wrap}
          .ff-viewbar-lbl{font-size:var(--text-xs);color:var(--meta);letter-spacing:.04em}
          .ff-seg{display:inline-flex;background:var(--surface);border:1px solid var(--border);
            border-radius:var(--radius-pill);padding:3px}
          .ff-seg-btn{display:inline-flex;align-items:center;gap:var(--space-1);min-height:36px;
            padding:0 var(--space-4);border:0;background:none;font-family:inherit;font-size:var(--text-sm);
            color:var(--muted);border-radius:var(--radius-pill);cursor:pointer;
            transition:background var(--motion-fast) var(--ease-standard),
              color var(--motion-fast) var(--ease-standard)}
          .ff-seg-btn.is-on{background:var(--accent);color:#fff}
          .ff-seg-btn:not(.is-on):active{background:var(--surface-2)}
          @media(max-width:480px){
            .ff-viewbar-lbl{display:none}
            .ff-seg{flex:1}
            .ff-seg-btn{flex:1;justify-content:center}
          }
        `}</style>
        <span className="ff-viewbar-lbl">视图</span>
        <div className="ff-seg" role="group" aria-label="切换工厂视图">
          <button
            type="button"
            className={`ff-seg-btn${view === 'journey' ? ' is-on' : ''}`}
            aria-pressed={view === 'journey'}
            onClick={() => setView('journey')}
          >
            <Icon name="list" size={16} />
            旅程
          </button>
          <button
            type="button"
            className={`ff-seg-btn${view === 'panorama' ? ' is-on' : ''}`}
            aria-pressed={view === 'panorama'}
            onClick={() => setView('panorama')}
          >
            <Icon name="columns" size={16} />
            全景
          </button>
        </div>
      </div>)}

      {effectiveView === 'panorama' ? (
        <FactoryFlow
          nodes={nodes}
          resourcesByNode={resourcesByNode}
          isDone={isDone}
          status={status}
          selectedKey={selectedKey}
          onSelect={select}
        />
      ) : (
        <FactoryJourney
          nodes={nodes}
          stages={stages}
          isDone={isDone}
          status={status}
          resourcesByNode={resourcesByNode}
          selectedKey={selectedKey}
          onSelect={select}
        />
      )}
      <FactoryExtras />
    </section>
  );
}
