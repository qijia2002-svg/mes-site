/**
 * 工厂系统关系图谱（工厂全景的认知脚手架）。
 *
 * 采纳自造物学堂 FabuLearn 原型的「五大系统全景图谱 + 三流」信息架构（改造计划 A1/A2），
 * 但严格走本平台 P0 规则：
 *  · 图标一律走 Icon.tsx 语义名（lucide），零 emoji；
 *  · 颜色只用 design-tokens（--accent / --success / --muted / --surface-* 等），零硬编码 hex、零渐变；
 *  · 交互只用背景/边框变化，零 transform 上浮、零弹跳缓动。
 *
 * 不引入原型「五系统独立新色」——系统间用图标 + 文案区分，高亮只用 --accent。
 */
import { useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';

type SysKey = 'erp' | 'mrp' | 'mes' | 'plc' | 'wms';
type FlowKey = 'info' | 'material' | 'control';

interface SysInfo {
  key: SysKey;
  name: string;
  abbr: string;
  icon: IconName;
  role: string;
  flows: FlowKey[];
}

const SYSTEMS: SysInfo[] = [
  { key: 'erp', name: '企业资源计划', abbr: 'ERP', icon: 'erp', role: '接单、排主生产计划，管财务与库存总账', flows: ['info'] },
  { key: 'mrp', name: '物料需求计划', abbr: 'MRP', icon: 'calculator', role: '按 BOM 与库存算物料缺口，生成采购与外协计划', flows: ['info', 'material'] },
  { key: 'mes', name: '制造执行系统', abbr: 'MES', icon: 'mes', role: '把工单落到产线：派工、报工、质量、追溯', flows: ['info', 'material', 'control'] },
  { key: 'plc', name: '可编程控制器', abbr: 'PLC', icon: 'plc', role: '采集设备信号、下发控制指令，驱动产线动作', flows: ['control'] },
  { key: 'wms', name: '仓储管理系统', abbr: 'WMS', icon: 'warehouse', role: '收货、上架、拣配、发运，管实物库存', flows: ['info', 'material'] },
];

const FLOWS: { key: FlowKey; name: string; icon: IconName; desc: string }[] = [
  { key: 'info', name: '信息流', icon: 'network', desc: '订单、计划、工单、报工在系统间传递' },
  { key: 'material', name: '物料流', icon: 'package', desc: '原料入库 → 上线 → 成品发货的实物流转' },
  { key: 'control', name: '控制流', icon: 'workflow', desc: 'PLC 采集信号、下发指令驱动设备' },
];

export default function SystemMap() {
  const [active, setActive] = useState<SysKey>('mes');
  const current = useMemo(() => SYSTEMS.find((s) => s.key === active)!, [active]);

  return (
    <section className="sysmap" aria-label="工厂系统关系图谱">
      <style>{`
        .sysmap{margin:var(--space-6) 0;padding:var(--space-5);background:var(--surface);
          border:1px solid var(--border);border-radius:var(--radius-md)}
        .sysmap h2{font-size:var(--text-xl);font-weight:var(--weight-announce-cjk);margin:0 0 var(--space-1)}
        .sysmap-sub{font-size:var(--text-sm);color:var(--muted);margin:0 0 var(--space-4)}
        .sysmap-row{display:flex;gap:var(--space-3);flex-wrap:wrap}
        .sysmap-chip{display:inline-flex;align-items:center;gap:var(--space-2);min-height:44px;
          padding:0 var(--space-4);border:1px solid var(--border);border-radius:var(--radius-pill);
          background:var(--surface-2);color:var(--fg);font-family:inherit;font-size:var(--text-sm);
          cursor:pointer;transition:border-color var(--motion-fast) var(--ease-standard),
            background var(--motion-fast) var(--ease-standard)}
        .sysmap-chip:hover{border-color:var(--accent-border)}
        .sysmap-chip[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
        .sysmap-chip .caps{font-size:var(--text-xs);color:var(--meta)}
        .sysmap-detail{margin-top:var(--space-4);padding:var(--space-4);border-radius:var(--radius-sm);
          background:var(--surface-2);border:1px solid var(--border)}
        .sysmap-detail-name{display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-lg);
          font-weight:var(--weight-announce-cjk)}
        .sysmap-detail-role{margin:var(--space-2) 0 0;font-size:var(--text-sm);color:var(--muted);line-height:var(--leading-body)}
        .sysmap-flows{display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-3)}
        .sysmap-flow{display:inline-flex;align-items:center;gap:var(--space-1);font-size:var(--text-xs);
          color:var(--meta);padding:2px var(--space-2);border:1px solid var(--border);border-radius:var(--radius-pill)}
        .sysmap-legend{display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-4);
          padding-top:var(--space-3);border-top:1px dashed var(--border)}
        .sysmap-legend-item{display:flex;align-items:flex-start;gap:var(--space-2);max-width:280px}
        .sysmap-legend-item p{margin:0;font-size:var(--text-xs);color:var(--muted);line-height:var(--leading-snug)}
        .sysmap-legend-item .lbl{display:flex;align-items:center;gap:var(--space-1);font-size:var(--text-sm);
          font-weight:var(--weight-emph-cjk);color:var(--fg)}
        @media(max-width:640px){.sysmap{padding:var(--space-4)}.sysmap-chip{flex:1 1 auto;justify-content:center}}
      `}</style>

      <h2>工厂系统关系图谱</h2>
      <p className="sysmap-sub">五个系统靠三条流咬合在一起。点一个系统，看它管什么、哪条流穿过它。</p>

      <div className="sysmap-row" role="group" aria-label="选择系统">
        {SYSTEMS.map((s) => (
          <button
            key={s.key}
            type="button"
            className="sysmap-chip"
            aria-pressed={active === s.key}
            onClick={() => setActive(s.key)}
          >
            <Icon name={s.icon} size={20} />
            <span>{s.name}</span>
            <span className="caps">{s.abbr}</span>
          </button>
        ))}
      </div>

      <div className="sysmap-detail" aria-live="polite">
        <div className="sysmap-detail-name">
          <Icon name={current.icon} size={20} />
          {current.name}
          <span className="caps" style={{ color: 'var(--meta)' }}>{current.abbr}</span>
        </div>
        <p className="sysmap-detail-role">{current.role}</p>
        <div className="sysmap-flows">
          {current.flows.map((f) => {
            const meta = FLOWS.find((x) => x.key === f)!;
            return (
              <span key={f} className="sysmap-flow">
                <Icon name={meta.icon} size={16} />
                {meta.name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="sysmap-legend">
        {FLOWS.map((f) => (
          <div key={f.key} className="sysmap-legend-item">
            <Icon name={f.icon} size={20} />
            <div>
              <span className="lbl">{f.name}</span>
              <p>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
