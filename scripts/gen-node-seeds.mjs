/**
 * 生成 12 个工厂节点种子文件（1 章节 + 3 测验 + 1 SQL + 1 微练习），并先做本地校验。
 *
 * 安全策略：
 *  - 章节/SQL/微练习 复用线上真实内容（fetch 后原样嵌入），保证种子与线上一致；
 *  - 每个节点新增 2 道测验，ID 动态取 MAX(questions.id)+1 之后，绝不串台；
 *  - 先在本机用真实 schema + 一个 generic-factory 流程（12 节点）跑通每文件，
 *    校验「每节点 3 测验 / 6 个 node_resources / 章节·SQL·微练习 都在」后才落盘，
 *    绝不直接碰生产库。
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS_DIR = resolve(ROOT, 'docs/seeds');
const SQLJS_DIST = dirname(require.resolve('sql.js'));
const initSqlJs = require('sql.js');

const esc = (s) => String(s ?? '').replace(/'/g, "''");
const jstr = (v) => esc(JSON.stringify(v));
const strip = (s) => String(s ?? '').replace(/\r?\n/g, ' ').slice(0, 38);
const nodeSub = (key) =>
  `(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = '${key}')`;

// 节点定义：chapter/sql/micro 用线上真实 ID；liveQuiz 是该节点已有的那道测验（保留）。
const NODE_DEFS = [
  { key: 'cust-order',   chapter: 9104, liveQuiz: 9204, sql: 9304, micro: 9401 },
  { key: 'order-review', chapter: 9105, liveQuiz: 9205, sql: 9305, micro: 9402 },
  { key: 'mps',          chapter: 9106, liveQuiz: 9206, sql: 9306, micro: 9403 },
  { key: 'mrp',          chapter: 9107, liveQuiz: 9207, sql: 9307, micro: 9404 },
  { key: 'purchase',     chapter: 9101, liveQuiz: 9201, sql: 9301, micro: 9405 },
  { key: 'bom-route',    chapter: 9108, liveQuiz: 9208, sql: 9308, micro: 9406 },
  { key: 'picking',      chapter: 9102, liveQuiz: 9202, sql: 9302, micro: 9407 },
  { key: 'dispatch',     chapter: 9109, liveQuiz: 9209, sql: 9309, micro: 9408 },
  { key: 'shopfloor',    chapter: 9110, liveQuiz: 9210, sql: 9310, micro: 9409 },
  { key: 'qc',           chapter: 9103, liveQuiz: 9203, sql: 9303, micro: 9410 },
  { key: 'stock-in',     chapter: 9111, liveQuiz: 9211, sql: 9311, micro: 9411 },
  { key: 'shipping',     chapter: 9112, liveQuiz: 9212, sql: 9312, micro: 9412 },
];

// 每节点新增 2 道测验（single 单选，0-based 答案索引，无生活比喻 ADR-021）。
const NEW_Q = {
  'cust-order': [
    { stem: '一张销售订单（SO）与工单（WO）的关系，通常哪种说法正确？',
      options: ['一张 SO 必然直接生成一张 WO，一一对应', '一个产品的一张 SO 常按批量/产线拆成多张 WO', '多张 SO 必须合并成一张 WO', 'SO 与 WO 没有任何关联'],
      answer: '1', explanation: 'SO 是客户需求承诺，MES 计划环节按产品+BOM+批量把一张 SO 拆成一张或多张 WO。拆批/合批由计划策略决定，并非永远一对一。' },
    { stem: 'sales_orders 表中的 due_date 字段表示什么？',
      options: ['销售录单的日期', '客户要求的交付日期', '实际发货日期', '生产开始日期'],
      answer: '1', explanation: 'due_date 是客户交期，计划据此倒排生产；实际发货看 shipments.ship_date，两者不是一回事。' },
  ],
  'order-review': [
    { stem: '订单评审（order-review）首要核对的是什么？',
      options: ['客户信用额度是否充足', '交期与技术可行性：产能、BOM、关键物料能否达成', '运输路线怎么走', '发票税率多少'],
      answer: '1', explanation: '评审核心是交期与可达成性——产能是否够、BOM 能否展开、关键物料是否齐套。信用额度属财务侧，不是评审技术核心。' },
    { stem: '一张销售订单通过评审后，下一步通常进入什么环节？',
      options: ['直接安排发货', '主生产计划（MPS）排产', '采购到货入库', '质量检验'],
      answer: '1', explanation: '评审通过 → MPS 把需求汇成产出计划 → MRP 算物料 → 采购/生产。评审通过只是放行，不直接发货。' },
  ],
  'mps': [
    { stem: '主生产计划（MPS）的主要输入来自哪里？',
      options: ['采购到货单', '评审通过的销售订单（需求）', '质量检验报告', '设备维修记录'],
      answer: '1', explanation: 'MPS 把评审通过的 SO 按产品汇总成计划产量，是 MRP 的上游输入。采购/质检是更下游的数据。' },
    { stem: 'MPS 与 MRP 的根本区别是什么？',
      options: ['MPS 管物料需求，MRP 管产出计划', 'MPS 管最终产品的产出计划，MRP 展开 BOM 算物料净需求', '两者完全相同', '都只管采购'],
      answer: '1', explanation: 'MPS=最终产品层面「产多少」；MRP=MPS 展开 BOM 后算「缺什么料、缺多少」。层级不同。' },
  ],
  'mrp': [
    { stem: 'MRP 计算物料净需求，必须依赖哪类基础数据？',
      options: ['设备保养状态', 'BOM（物料清单）+ 库存 + 在制', '客户名称列表', '历史发货记录'],
      answer: '1', explanation: '净需求 = 总需求(BOM×产量) − 库存 − 在制 − 已订未到。BOM 是把产品拆成物料的关键。' },
    { stem: '某物料经 MRP 算出的净需求为负数，说明什么？',
      options: ['系统算错了', '已有库存+在制约覆盖需求，无需采购', '要超量采购备货', '该物料已停产'],
      answer: '1', explanation: '负净需求=现有存量已满足总需求，不必补货（安全库存另行考虑）。不是错误。' },
  ],
  'purchase': [
    { stem: 'purchase_orders 里如何判断一张采购单逾期？',
      options: ['看 po_no 编号大小', '实际到货 arrive_date 晚于期望 expect_date，或应到未到', '看 supplier_id', '看采购数量 qty'],
      answer: '1', explanation: '逾期=实际到货日晚于期望日，或期望日已过仍无到货(arrive_date 为空)。这是跟催的依据。' },
    { stem: '采购单逾期，最直接影响的下游环节是？',
      options: ['订单评审', '领料（picking）缺料', '质量检验', '发货出库'],
      answer: '1', explanation: '料不到 → 仓库补不上 → 领料环节缺料 → 工单开不了工。这是采购→领料→派工→车间 的传导链起点。' },
  ],
  'bom-route': [
    { stem: 'BOM（物料清单）在 MES 中的主要作用？',
      options: ['记录客户联系信息', '展开产品由哪些物料构成及单台用量', '安排设备保养', '管理发货物流'],
      answer: '1', explanation: 'BOM 定义产品→物料的构成与单台用量 qty_per，是 MRP 与应发料量计算的基础。' },
    { stem: 'bom 表中的 loss_rate（损耗率）主要影响什么？',
      options: ['产品售价', '应发料量（需叠加损耗）', '设备运行状态', '客户交期'],
      answer: '1', explanation: '应发量 = 理论用量 × (1 + loss_rate)。损耗率越高，备料越多，否则生产中容易缺料。' },
  ],
  'picking': [
    { stem: 'pick_lists 中 qty_pick < qty_req 表示什么？',
      options: ['领料超额', '缺料，实领少于需求', '物料已齐套', '工单已取消'],
      answer: '1', explanation: '实领小于需求=缺料，缺口 = qty_req − qty_pick。领料齐套是开工前置条件。' },
    { stem: '工单能够领料的前提是什么？',
      options: ['客户已付款', '工单已 released 且关键物料齐套', '质量检验已通过', '发货已完成'],
      answer: '1', explanation: '领料面向已下达(released)工单，且依赖采购到货齐套；否则就会出现缺料缺口。' },
  ],
  'dispatch': [
    { stem: '工单状态 released 代表什么含义？',
      options: ['已完工入库', '已下达、可以开工，但还没真正生产', '已关闭结算', '已通过质检'],
      answer: '1', explanation: 'released=计划员下达指令，可以开工了。真正开始生产以 production_records 出现首条报工、状态跳 running 为标志。' },
    { stem: '判断一张工单能否派工开工，关键要确认哪三样？',
      options: ['客户、发票、运输', '设备状态 × 操作工在岗 × 物料齐套', '价格、折扣、税率', '供应商、合同、账期'],
      answer: '1', explanation: '派工三要素：设备是否在运行、车间有无在岗工人、物料是否齐套。缺任何一样车间都会回「开不了工」。' },
  ],
  'shopfloor': [
    { stem: 'production_records 中的一条记录代表什么？',
      options: ['一张完整工单', '某设备某工人一次报工的合格/不良产量', '一次采购到货', '一次发货'],
      answer: '1', explanation: '每次报工写入一条 production_records：qty_ok 合格数、qty_ng 不良数，累计成工单完工量。' },
    { stem: '车间报工中，合格率的标准口径是？',
      options: ['qty_ok / qty_plan', 'qty_ok / (qty_ok + qty_ng)', 'qty_ng / qty_plan', 'qty_done / qty_plan'],
      answer: '1', explanation: '合格率 = 合格 / (合格 + 不良)。不良在 qty_ng 字段。判题与绩效都用这个口径。' },
  ],
  'qc': [
    { stem: 'quality_checks 表的 result 字段取值通常是？',
      options: ['0 或 1 数字', '合格 / 不合格', '百分制分数', '颜色标记'],
      answer: '1', explanation: '检验结果用 合格/不合格 表示，不合格记录会带 defect_type 缺陷类型，供后续追溯。' },
    { stem: '一批产品被判不合格（QC 判不合格），优先往哪里追溯根因？',
      options: ['客户档案', '产出它的设备与操作工（production_records）', '发票信息', '运输单据'],
      answer: '1', explanation: '从 quality_checks 关联 production_records，可定位是哪台设备、哪个工人产出了不良，是质量追溯的主线。' },
  ],
  'stock-in': [
    { stem: '生产入库（stock-in）前必须核对什么？',
      options: ['报工完工数与入库数是否一致', '客户是否签字', '发票金额', '发货地址'],
      answer: '1', explanation: '入库前对账：production_records 累计完工 vs 本次入库数，不一致要先查清再入库，避免账实不符。' },
    { stem: '生产入库（stock-in）更新的是哪类数据？',
      options: ['在制工单状态', '产成品库存', '采购订单', '销售订单'],
      answer: '1', explanation: '入库把产成品从在制(WIP)结转为成品库存，是生产→库存的结转动作。' },
  ],
  'shipping': [
    { stem: 'shipments 发货的依据来自哪里？',
      options: ['采购到货单', '对应销售订单/工单的完工入库', '质量抽检单', '设备运行记录'],
      answer: '1', explanation: '发货来自 SO 对应 WO 完工入库的成品，shipments.so_id / wo_id 关联回去。没完工入库不能发。' },
    { stem: '监控「尾批逾期、整单未发」这类情况，是为了发现什么风险？',
      options: ['采购延迟', '交付违约风险（该发未发/已逾期）', '设备故障', '物料损耗'],
      answer: '1', explanation: '尾批未发或整单未发=交付违约，是发货环节核心监控点，直接影响客户交期与满意度。' },
  ],
};

// ---------- fetch content from local JSON (fetched via tmp/fetch-seed-content.mjs) ----------
const live = {};
function fetchLive() {
  const chapters = JSON.parse(readFileSync(resolve(ROOT, 'tmp/seed-chapters.json'), 'utf8'));
  const questions = JSON.parse(readFileSync(resolve(ROOT, 'tmp/seed-questions.json'), 'utf8'));
  const sqls = JSON.parse(readFileSync(resolve(ROOT, 'tmp/seed-sql.json'), 'utf8'));
  const micros = JSON.parse(readFileSync(resolve(ROOT, 'tmp/seed-micro.json'), 'utf8'));
  const chById = Object.fromEntries(chapters.map((r) => [r.id, r]));
  const qById = Object.fromEntries(questions.map((r) => [r.id, r]));
  const sqById = Object.fromEntries(sqls.map((r) => [r.id, r]));
  const miById = Object.fromEntries(micros.map((r) => [r.id, r]));
  for (const n of NODE_DEFS) {
    const ch = chById[n.chapter];
    const q1 = qById[n.liveQuiz];
    const sq = sqById[n.sql];
    const mi = miById[n.micro];
    if (!ch || !q1 || !sq || !mi) throw new Error(`节点 ${n.key} 内容缺失: ch=${!!ch} q1=${!!q1} sq=${!!sq} mi=${!!mi}`);
    live[n.key] = { ch, q1, sq, mi };
  }
  console.log('  已载入本地内容：', Object.keys(live).length, '节点');
}

// 动态新测验 ID：线上 questions.id 最大值已确认 9215，从 9221 起绝不串台。
const maxQ = 9215;
const base = Math.max(9221, maxQ + 1);
NODE_DEFS.forEach((n, i) => { n.qids = [n.liveQuiz, base + i * 2, base + i * 2 + 1]; });

// ---------- build one seed ----------
function buildSeed(def) {
  const { ch, q1, sq, mi } = live[def.key];
  const [q1id, q2id, q3id] = def.qids;
  const managed = [def.chapter, q1id, q2id, q3id, def.sql, def.micro];
  const L = [];
  L.push(`-- ============================================================`);
  L.push(`-- 节点种子：${def.key}（generic-factory）`);
  L.push(`-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）`);
  L.push(`-- 章节 ${def.chapter} | 测验 ${q1id},${q2id},${q3id} | SQL ${def.sql} | 微练习 ${def.micro}`);
  L.push(`-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。`);
  L.push(`-- ============================================================`);
  L.push(`PRAGMA foreign_keys = OFF;`);
  L.push(``);
  L.push(`-- 重跑安全：只删本文件管理的 ID，不动其它节点资源`);
  L.push(`DELETE FROM chapters WHERE id = ${def.chapter};`);
  L.push(`DELETE FROM questions WHERE id IN (${q1id}, ${q2id}, ${q3id});`);
  L.push(`DELETE FROM sql_exercises WHERE id = ${def.sql};`);
  L.push(`DELETE FROM micro_practices WHERE id = ${def.micro};`);
  L.push(`DELETE FROM node_resources WHERE node_id = ${nodeSub(def.key)} AND ref_id IN (${managed.join(', ')}) AND res_type IN ('chapter','quiz','sql','micro');`);
  L.push(``);
  L.push(`-- 章节 ${def.chapter}`);
  L.push(`INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (`);
  L.push(`  ${def.chapter}, ${ch.topic_id}, '${esc(ch.title)}', ${ch.sort}, '${esc(ch.status)}', '${esc(ch.md_text)}', ${ch.schema_version}, strftime('%s','now'));`);
  L.push(``);
  L.push(`-- 测验 ${q1id},${q2id},${q3id}（${q1id}=线上已有，保留；后两道新增）`);
  const qRows = [
    { id: q1id, type: q1.type, stem: q1.stem, options: q1.options, answer: q1.answer, explanation: q1.explanation, sort: 1 },
    { id: q2id, ...NEW_Q[def.key][0], sort: 2 },
    { id: q3id, ...NEW_Q[def.key][1], sort: 3 },
  ];
  L.push(`INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES`);
  L.push(qRows.map((r) =>
    `  (${r.id}, ${def.chapter}, '${esc(r.type)}', '${esc(r.stem)}', '${jstr(r.options)}', '${esc(r.answer)}', '${esc(r.explanation)}', ${r.sort}, strftime('%s','now'))`,
  ).join(',\n') + ';');
  L.push(``);
  L.push(`-- SQL 练习 ${def.sql}（复用线上真实哈希，未重新计算）`);
  L.push(`INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (`);
  L.push(`  ${def.sql}, ${sq.topic_id}, '${esc(sq.title)}', '${esc(sq.prompt)}', '${esc(sq.dataset_json)}', '${esc(sq.answer_sql)}', '${esc(sq.answer_hash)}', '${esc(sq.schema_hint)}', ${sq.sort}, strftime('%s','now'));`);
  L.push(``);
  L.push(`-- 微练习 ${def.micro}（node_id 关联节点，无 chapter_id）`);
  L.push(`INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (`);
  L.push(`  ${def.micro}, ${nodeSub(def.key)}, '${esc(mi.kind)}', '${esc(mi.prompt)}', '${esc(mi.payload)}', '${esc(mi.answer)}', '${esc(mi.feedback_ok)}', '${esc(mi.feedback_bad)}', ${mi.sort});`);
  L.push(``);
  L.push(`-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）`);
  L.push(`INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES`);
  const nr = [
    [def.chapter, 'chapter', ch.title, 1],
    [q1id, 'quiz', strip(q1.stem), 2],
    [q2id, 'quiz', strip(NEW_Q[def.key][0].stem), 3],
    [q3id, 'quiz', strip(NEW_Q[def.key][1].stem), 4],
    [def.sql, 'sql', sq.title, 5],
    [def.micro, 'micro', strip(mi.prompt), 6],
  ];
  L.push(nr.map((r) =>
    `  (${nodeSub(def.key)}, '${r[1]}', ${r[0]}, '${esc(r[2]).slice(0, 40)}', ${r[3]})`,
  ).join(',\n') + ';');
  L.push(``);
  L.push(`PRAGMA foreign_keys = ON;`);
  return L.join('\n');
}

// ---------- 本地校验（真实 schema + generic-factory 12 节点） ----------
async function validateAll(built) {
  const SQL = await initSqlJs({ locateFile: (f) => resolve(SQLJS_DIST, f) });
  const schemaSql = readFileSync(resolve(ROOT, 'tmp/schema_full.sql'), 'utf8');
  const errors = [];
  for (const def of NODE_DEFS) {
    const db = new SQL.Database();
    try {
      db.run(schemaSql);
      db.run(`INSERT INTO flowcharts (id, slug, title, created_at, updated_at) VALUES (1, 'generic-factory', '通用工厂主线', 0, 0);`);
      NODE_DEFS.forEach((n, i) => {
        db.run(`INSERT INTO flow_nodes (id, flow_id, node_key, label, x, y, sort) VALUES (${i + 1}, 1, '${n.key}', '${n.key}', ${i}, 0, ${i});`);
      });
      db.run(built[def.key]); // 整段执行，语法错会抛
      const one = (q) => db.exec(q)[0].values[0][0];
      const qCount = one(`SELECT count(*) FROM questions WHERE chapter_id = ${def.chapter}`);
      const nrCount = one(`SELECT count(*) FROM node_resources WHERE node_id = ${nodeSub(def.key)}`);
      const chOk = one(`SELECT count(*) FROM chapters WHERE id = ${def.chapter}`);
      const sqlOk = one(`SELECT count(*) FROM sql_exercises WHERE id = ${def.sql}`);
      const miOk = one(`SELECT count(*) FROM micro_practices WHERE id = ${def.micro}`);
      // 新测验选项可解析且答案索引合法
      const newQuizIds = [def.qids[1], def.qids[2]];
      for (const qid of newQuizIds) {
        const row = db.exec(`SELECT options, answer FROM questions WHERE id = ${qid}`)[0].values[0];
        const opts = JSON.parse(row[0]);
        const ans = Number(row[1]);
        if (!Array.isArray(opts) || opts.length < 2) throw new Error(`测验 ${qid} 选项非法`);
        if (ans < 0 || ans >= opts.length) throw new Error(`测验 ${qid} 答案索引越界 ${ans}`);
      }
      if (qCount !== 3) errors.push(`${def.key}: 测验数=${qCount} (期望3)`);
      if (nrCount !== 6) errors.push(`${def.key}: node_resources=${nrCount} (期望6)`);
      if (chOk !== 1) errors.push(`${def.key}: 章节缺失`);
      if (sqlOk !== 1) errors.push(`${def.key}: SQL 缺失`);
      if (miOk !== 1) errors.push(`${def.key}: 微练习缺失`);
    } catch (e) {
      errors.push(`${def.key}: 校验异常 ${e.message}`);
    } finally {
      db.close();
    }
  }
  return errors;
}

// ---------- main ----------
async function main() {
  console.log('[start] fetching live content...');
  await fetchLive();
  console.log('[ok] live content fetched for', Object.keys(live).length, 'nodes');
  const built = {};
  for (const def of NODE_DEFS) built[def.key] = buildSeed(def);
  console.log('[ok] built 12 seed strings');

  console.log('本地校验中（真实 schema + 12 节点）...');
  const errors = await validateAll(built);
  if (errors.length) {
    console.error('校验未通过：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('校验通过 ✓  新测验 ID 基址 =', base, '（MAX 线上 questions.id =', maxQ, '）');

  // 备份 3 个旧（串台）种子文件
  const oldDir = resolve(ROOT, 'tmp/old-node-seeds-2026-08-09');
  mkdirSync(oldDir, { recursive: true });
  for (const k of ['dispatch', 'mrp', 'bom-route']) {
    const f = resolve(SEEDS_DIR, `seed-node-${k}.sql`);
    if (existsSync(f)) renameSync(f, resolve(oldDir, `seed-node-${k}.sql`));
  }

  mkdirSync(SEEDS_DIR, { recursive: true });
  for (const def of NODE_DEFS) {
    writeFileSync(resolve(SEEDS_DIR, `seed-node-${def.key}.sql`), built[def.key], 'utf8');
  }
  console.log(`已写出 12 个种子文件到 docs/seeds/seed-node-<key>.sql`);
  console.log('每节点：章节', '(复用线上)', '| 测验', `${base}..${base + 23}`, '| SQL/micro 复用线上');
}

main().catch((e) => { console.error('[FATAL]', e instanceof Error ? e.stack : String(e)); process.exit(1); });
