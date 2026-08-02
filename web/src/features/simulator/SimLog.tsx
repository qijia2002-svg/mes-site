/**
 * 右侧运行日志面板：仿真执行时的输出。
 * 当前展示静态搭建信息，后续接入仿真引擎后显示实时日志。
 */
import { Icon } from '../../components/Icon';

interface LogEntry {
  ts: string;
  type: 'info' | 'ok' | 'warn';
  msg: string;
}

interface Props {
  nodes: { id: string; label: string; nodeType: string }[];
  edges: { id: string; from: string; to: string }[];
}

function generateLog(nodes: Props['nodes'], edges: Props['edges']): LogEntry[] {
  const now = new Date();
  const t = (s: number) => new Date(now.getTime() - s * 1000).toLocaleTimeString('zh-CN');

  const logs: LogEntry[] = [];
  logs.push({ ts: t(0), type: 'info', msg: '画布已就绪，等待搭建流程' });

  if (nodes.length === 0) {
    logs.push({ ts: t(0), type: 'warn', msg: '画布为空，请从左侧拖拽工序节点' });
    return logs;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const hasInspect = nodes.some((n) => n.nodeType.startsWith('i_'));
  const hasEndpoint = nodes.some((n) => n.nodeType === 'material' || n.nodeType === 'ship');
  const hasProcess = nodes.some((n) => n.nodeType !== 'material' && n.nodeType !== 'ship' && !n.nodeType.startsWith('i_'));

  if (hasEndpoint) logs.push({ ts: t(5), type: 'ok', msg: '起止节点已设置 ✓' });
  if (hasProcess) logs.push({ ts: t(4), type: 'ok', msg: `已添加 ${nodes.filter((n) => n.nodeType !== 'material' && n.nodeType !== 'ship' && !n.nodeType.startsWith('i_')).length} 个加工节点` });
  if (hasInspect) logs.push({ ts: t(3), type: 'ok', msg: `已添加 ${nodes.filter((n) => n.nodeType.startsWith('i_')).length} 个检验节点` });

  if (edges.length > 0) {
    logs.push({ ts: t(2), type: 'ok', msg: `${edges.length} 条连线已建立` });
    logs.push({ ts: t(1), type: 'info', msg: '工艺流程连通，可运行仿真查看流转' });
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

export default function SimLog({ nodes, edges }: Props) {
  const logs = generateLog(nodes, edges);

  return (
    <aside className="sim-log">
      <div className="sim-log-title">
        <Icon name="sql" size={16} />
        运行日志
      </div>
      <div className="sim-log-body">
        {logs.map((entry, i) => (
          <div key={i} className={`sim-log-entry sim-log-${entry.type}`}>
            <span className="sim-log-time">{entry.ts}</span>
            <span className="sim-log-msg">{entry.msg}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
