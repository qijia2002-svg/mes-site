/**
 * 右侧运行日志面板：仿真执行时显示实时流转日志；
 * 未运行时显示画布搭建状态。
 */
import { Icon } from '../../components/Icon';
import type { SimLogEntry } from './simEngine';

interface StaticLog {
  ts: string;
  type: 'info' | 'ok' | 'warn';
  msg: string;
}

interface Props {
  nodes: { id: string; label: string; nodeType: string }[];
  edges: { id: string; from: string; to: string }[];
  runLogs?: SimLogEntry[];
  running?: boolean;
  metrics?: import('./simEngine').SimMetrics | null;
}

function buildLog(nodes: Props['nodes'], edges: Props['edges']): StaticLog[] {
  const now = new Date();
  const t = (s: number) => new Date(now.getTime() - s * 1000).toLocaleTimeString('zh-CN');
  const logs: StaticLog[] = [];
  logs.push({ ts: t(0), type: 'info', msg: '画布已就绪，等待搭建流程' });

  if (nodes.length === 0) {
    logs.push({ ts: t(0), type: 'warn', msg: '画布为空，请点击左侧工序库添加工序' });
    return logs;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const hasInspect = nodes.some((n) => n.nodeType.startsWith('i_'));
  const hasEndpoint = nodes.some((n) => n.nodeType === 'material' || n.nodeType === 'ship');
  const hasProcess = nodes.some((n) => n.nodeType !== 'material' && n.nodeType !== 'ship' && !n.nodeType.startsWith('i_'));

  if (hasEndpoint) logs.push({ ts: t(5), type: 'ok', msg: '起止节点已设置' });
  if (hasProcess) logs.push({ ts: t(4), type: 'ok', msg: `已添加 ${nodes.filter((n) => n.nodeType !== 'material' && n.nodeType !== 'ship' && !n.nodeType.startsWith('i_')).length} 个加工节点` });
  if (hasInspect) logs.push({ ts: t(3), type: 'ok', msg: `已添加 ${nodes.filter((n) => n.nodeType.startsWith('i_')).length} 个检验节点` });

  if (edges.length > 0) {
    logs.push({ ts: t(2), type: 'ok', msg: `${edges.length} 条连线已建立` });
    logs.push({ ts: t(1), type: 'info', msg: '工艺流程连通，点击「运行仿真」查看工单流转' });
  } else if (nodes.length >= 2) {
    logs.push({ ts: t(2), type: 'warn', msg: '节点间尚未连线，请连接工序端口' });
  }

  for (const e of edges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (from && to) logs.push({ ts: t(1), type: 'info', msg: `${from.label} → ${to.label}` });
  }
  return logs;
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="sim-metric">
      <span className="sim-metric-label">{label}</span>
      <span className="sim-metric-value" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

export default function SimLog({ nodes, edges, runLogs, running, metrics }: Props) {
  const useRun = !!runLogs && runLogs.length > 0;

  return (
    <aside className="sim-log">
      <div className="sim-log-title">
        <Icon name="sql" size={16} />
        {running ? '仿真运行中…' : '运行日志'}
      </div>

      {metrics && (
        <div className="sim-metrics">
          <MetricRow label="投产" value={`${metrics.total}`} />
          <MetricRow label="合格发货" value={`${metrics.passed}`} accent="var(--success)" />
          <MetricRow label="不良" value={`${metrics.defective}`} accent="var(--warn)" />
          <MetricRow label="返工" value={`${metrics.reworked}`} />
          <MetricRow label="报废" value={`${metrics.scrapped}`} accent="var(--danger)" />
          <MetricRow label="累计工时" value={`${metrics.leadTimeMin} 分`} />
        </div>
      )}

      <div className="sim-log-body">
        {(useRun ? runLogs! : buildLog(nodes, edges)).map((entry, i) => (
          <div key={i} className={`sim-log-entry sim-log-${(entry as any).type}`}>
            <span className="sim-log-time">{entry.ts}</span>
            <span className="sim-log-msg">{entry.msg}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
