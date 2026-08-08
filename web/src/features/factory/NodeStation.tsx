/**
 * 工厂全景节点详情面板（inline，看练同屏）。
 *
 * 不再用写死的 DRILLS 跳通用页（C3），而是消费后端下发的 node_resources：
 * 每个资源是一个祈使句标题（C2）的实战入口，按类型跳对应路由——
 *   chapter → /chapters/:id（知识卡片）
 *   sql     → /sql-space/:id（SQL 实战）
 *   quiz    → /quiz/q/:id（随堂测验）
 * 资源类型对应的完成态由 isDone(type, refId) 决定（C1：只认实战）。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import { PHASE_LABEL, SYSTEM_HINTS, type LaidNode } from './factoryFlow.data';

interface NodeStationProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
  onClose: () => void;
}

const RES_META: Record<string, { icon: IconName; to: (id: number) => string }> = {
  chapter: { icon: 'chapter', to: (id) => `/chapters/${id}` },
  sql: { icon: 'sql', to: (id) => `/sql-space/${id}` },
  quiz: { icon: 'quiz', to: (id) => `/quiz/q/${id}` },
  sim: { icon: 'routing', to: () => '/factory?mode=build' },
};

export default function NodeStation({ node, resources, isDone, onClose }: NodeStationProps) {
  const sorted = [...resources].sort((a, b) => a.sort - b.sort);
  const hints = SYSTEM_HINTS[node.key] ?? [];

  return (
    <>
      <div className="p-head">
        <span className="pic"><Icon name={node.icon as IconName} size={20} /></span>
        <h3>{node.label}</h3>
        <button type="button" className="close" onClick={onClose} aria-label="收起">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="p-meta">
        <span className="dot" style={{ background: `var(--phase-${node.phase})` }} />
        <span>{PHASE_LABEL[node.phase]}</span>
        <span className="sp">·</span>
        <span>
          {node.kind === 'entry' ? '流程起点' : node.kind === 'exit' ? '流程终点' : '生产环节'}
        </span>
      </div>
      <div className="p-body">
        <div>
          <p className="p-know">{node.description}</p>
          {hints.length > 0 && (
            <>
              <div className="p-sec">涉及系统</div>
              <div className="p-tags">
                {hints.map((s) => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="p-sec">在这个环节动手练</div>
          {sorted.length === 0 ? (
            <p className="p-know">这个环节暂未挂实战内容，先往后走。</p>
          ) : (
            sorted.map((r) => {
              const meta = RES_META[r.type] ?? RES_META.chapter;
              const done = isDone(r.type, r.refId);
              return (
                <Link key={`${r.type}:${r.refId}`} to={meta.to(r.refId)} className="drill">
                  <span className="di"><Icon name={meta.icon} size={20} /></span>
                  <span>
                    <span className="dl">{r.title}</span>
                  </span>
                  {done ? (
                    <span className="dgo" style={{ color: 'var(--success)' }} aria-label="已完成">
                      <Icon name="check-circle" size={16} />
                    </span>
                  ) : (
                    <span className="dgo"><Icon name="chevron-right" size={16} /></span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
