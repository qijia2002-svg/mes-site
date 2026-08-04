/**
 * 名词搜索小框：顶部搜索入口，输入术语 → 即时匹配 → 显示解释。
 * 术语库来自 MES 知识体系，覆盖制造执行、ERP、SQL、PLC 核心概念。
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { WordSpeaker } from './WordSpeaker';

const GLOSSARY: { term: string; aliases: string[]; def: string }[] = [
  { term: 'MES', aliases: ['制造执行系统','mes'], def: 'Manufacturing Execution System，面向车间执行层的生产数字化管理系统。位于 ERP（计划层）与 PLC（控制层）之间，管"怎么做、做了多少"。' },
  { term: 'ERP', aliases: ['企业资源计划','erp'], def: 'Enterprise Resource Planning，企业资源计划系统。管"计划做什么"——从销售订单到财务结算的全流程，MES 的上游系统。' },
  { term: 'PLC', aliases: ['可编程逻辑控制器','plc'], def: 'Programmable Logic Controller，工业控制计算机。管"设备怎么动"——接收 MES 指令，控制产线设备执行动作，并回传实时数据。' },
  { term: '工单', aliases: ['生产工单','work order','WO'], def: '生产指令单，告诉车间：做什么产品、做多少、什么时候交。MES 核心流转对象，贯穿从下达到入库的全过程。' },
  { term: 'BOM', aliases: ['物料清单','bill of materials','bom'], def: 'Bill of Materials，物料清单。一个产品由哪些零件/原料组成，每层用量多少。MES 根据 BOM 做齐套检查、物料追溯。' },
  { term: '工艺路线', aliases: ['routing','工序流程'], def: '产品从原材料到成品的完整加工流程说明书。包含五大要素：工序名称、顺序、加工设备、工艺参数、技能要求。' },
  { term: '报工', aliases: ['生产报工','完工汇报'], def: '工人完成一道工序后，在 MES 中记录"我做了多少、合格多少、用了多长时间"。触发工单进度更新和绩效统计。' },
  { term: '追溯', aliases: ['质量追溯','正向追溯','反向追溯'], def: '通过批次/SN码，从成品反查用了哪些原料、经过哪些工序、谁操作的（反向追溯）；或从原料查到成品去向（正向追溯）。' },
  { term: '批次', aliases: ['lot','batch','批号'], def: '同一条件下生产的一组产品的集合标识。用于质量追溯——出现问题时可定位到具体批次范围。' },
  { term: 'SN码', aliases: ['序列号','serial number','SN'], def: 'Serial Number，产品唯一标识。每个产品一个号，比批次更精细——可追溯到具体某一个产品的全部生产过程。' },
  { term: 'OEE', aliases: ['设备综合效率','稼动率','oee'], def: 'Overall Equipment Effectiveness，设备综合效率。OEE = 时间开动率 × 性能开动率 × 合格品率，衡量设备利用水平的核心指标。' },
  { term: '安灯', aliases: ['andon','安灯系统'], def: 'Andon，产线异常呼叫系统。工人遇到问题（缺料/设备故障/质量问题）按灯或拉绳，班组长/维修立即响应。' },
  { term: '看板', aliases: ['kanban','电子看板'], def: '车间可视化显示屏，实时展示生产进度、质量数据、设备状态。MES 数据驱动的"车间仪表盘"。' },
  { term: '齐套', aliases: ['齐套检查','齐套性'], def: '开工前检查生产工单所需的所有物料是否备齐。缺料则无法开工，MES 自动校验 BOM 用量 vs 库存可用量。' },
  { term: 'ISA-95', aliases: ['isa95','IEC 62264'], def: '国际自动化协会制定的企业-控制系统集成标准。定义了 ERP/MES/PLC 三层模型和 MES 的 11 个功能模块，是 MES 产品的"圣经"。' },
  { term: 'SCADA', aliases: ['scada','数据采集与监控'], def: 'Supervisory Control and Data Acquisition，数据采集与监视控制系统。从 PLC/传感器采集实时数据，提供给 MES 使用。' },
  { term: 'OPC UA', aliases: ['opcua','OPC统一架构'], def: 'Open Platform Communications Unified Architecture，工业通信协议标准。跨平台、安全加密，是现代 MES 与设备层对接的首选协议。' },
  { term: 'Modbus', aliases: ['modbus','Modbus RTU','Modbus TCP'], def: '工业现场总线协议，简单、开放、兼容性好。RTU 走串口（RS485），TCP 走以太网，PLC/传感器普遍支持。' },
  { term: 'MRP', aliases: ['mrp','物料需求计划'], def: 'Material Requirements Planning，根据生产计划+BOM+库存，自动计算需要买什么物料、什么时候到。ERP 的核心运算模块。' },
  { term: 'UAT', aliases: ['uat','用户验收测试'], def: 'User Acceptance Testing，用户验收测试。MES 上线前由客户关键用户按照真实业务场景操作验证，通过后签字验收。' },
  { term: '工位', aliases: ['workstation'], def: '车间中为完成特定工序划分的固定空间和功能位置。一般一个工位对应一个操作工人。' },
  { term: '流水线', aliases: ['assembly line'], def: '把生产过程分解为一系列简单操作，产品依次经过各个工位加工处理的生产组织形式。' },
  { term: '稼动率', aliases: ['设备稼动率','utilization'], def: '设备实际运行时间占可运行时间的比例。衡量设备利用效率，OEE 的第一因子。' },
  { term: 'SQL', aliases: ['sql','Structured Query Language'], def: '结构化查询语言，操作数据库的标准语言。MES 实施中用于查询生产数据、排查数据问题、写报表。' },
  { term: 'JOIN', aliases: ['join','表连接'], def: 'SQL 中连接多张表的操作。INNER JOIN 取交集，LEFT JOIN 保留左表全部行。MES 中常用来关联工单+报工+物料表。' },
  { term: 'D1', aliases: ['d1','Cloudflare D1'], def: 'Cloudflare 的 serverless SQLite 数据库。本平台的后端存储，免费额度 500MB/5 亿次读取/月。' },
  { term: 'API', aliases: ['api','Application Programming Interface'], def: '应用程序编程接口。前后端之间通过 API 交换数据，本平台 API 走 RESTful 风格。' },
  { term: 'WMS', aliases: ['wms','仓库管理系统'], def: 'Warehouse Management System，仓库管理系统。管理物料入库、出库、库位、盘点，与 MES 通过接口同步库存数据。' },
  { term: 'APS', aliases: ['aps','高级排程'], def: 'Advanced Planning and Scheduling，高级计划排程。比 ERP 的 MRP 更精细——考虑设备产能、模具约束、交货期，生成可执行的日排程。' },
  { term: 'IPQC', aliases: ['ipqc','制程质量控制'], def: 'In-Process Quality Control，制程质量控制。生产过程中的检验（首检、巡检），区别于成品入库前的 FQC。' },
  { term: 'KPI', aliases: ['kpi','关键绩效指标'], def: 'Key Performance Indicator，关键绩效指标。衡量产线/员工表现的量化指标，如日产能、合格率、OEE。' },
];

function matchScore(term: string, query: string): number {
  const t = term.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}

export default function GlossarySearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return GLOSSARY.slice(0, 8);
    return GLOSSARY
      .map((g) => ({
        ...g,
        score: Math.max(
          matchScore(g.term, query),
          ...g.aliases.map((a) => matchScore(a, query)),
        ),
      }))
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [query]);

  return (
    <div className="glossary-wrap">
      <button
        type="button"
        className="icon-btn"
        title="搜索术语 (Ctrl+K)"
        onClick={() => setOpen(!open)}
        aria-label="打开术语搜索"
      >
        <Icon name="empty-search" size={20} />
      </button>

      {open && (
        <div className="glossary-overlay" onClick={() => { setOpen(false); setQuery(''); }}>
          <div className="glossary-panel" onClick={(e) => e.stopPropagation()}>
            <div className="glossary-input-row">
              <Icon name="empty-search" size={16} />
              <input
                ref={inputRef}
                className="glossary-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 MES 术语…（Ctrl+K）"
              />
              <button type="button" className="icon-btn" onClick={() => { setOpen(false); setQuery(''); }}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="glossary-results">
              {results.length === 0 && query && (
                <p className="glossary-empty">未找到"{query}"相关术语</p>
              )}
              {results.map((g) => (
                <div key={g.term} className="glossary-item">
                  <div className="glossary-term">
                    {g.term}
                    <WordSpeaker word={g.term} className="glossary-term-speaker" />
                  </div>
                  <div className="glossary-aliases">{g.aliases.slice(0, 3).join(' · ')}</div>
                  <div className="glossary-def">{g.def}</div>
                </div>
              ))}
              {!query && (
                <p className="glossary-hint">输入关键词搜索制造术语，或浏览常用定义</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
