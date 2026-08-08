/**
 * 把脑库 10_Learning 中「现有 10 条路线里还空着的模块」+ 两个新模块
 * （WMS/APS/BI、精益生产与 IE）导入 D1。
 *
 * 设计：
 *  - 章节显式 id（9001+），topic 显式 id（6001+），新 track 11/12 —— 便于 track_level_chapters 连线。
 *  - 正文剥离 YAML frontmatter，Obsidian 双链 [[x|y]]→y / [[x]]→x。
 *  - 全部 INSERT OR IGNORE，可重复执行。
 *
 * 用法：node scripts/import-brainlib-gap.mjs
 * 产出：worker/public/import-brainlib-gap.sql
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = 'E:/我的脑库/10_Learning（学习）';

const now = Date.now(); // ms

function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('---', 3);
  if (end === -1) return text;
  return text.slice(end + 3).replace(/^\n+/, '');
}
function convertWikilinks(text) {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}
function esc(s) {
  return String(s).replace(/'/g, "''");
}

// 读取并清洗正文
function bodyOf(rel) {
  const raw = readFileSync(join(SRC, rel), 'utf-8');
  return convertWikilinks(stripFrontmatter(raw)).trim();
}

// ---- 新 topic（id, slug, title, description, modules） ----
const newTopics = [
  [6001, 'industrial-network', '工业网络与通讯', '工业以太网、Modbus/OPC UA/Profinet、交换机与协议转换，现场设备互联互通的基础。', '["工业网络","通讯","现场必备"]'],
  [6002, 'linux-ops', 'Linux 与服务器运维', 'Linux 基础、常用命令、服务部署、网络排查、备份容灾，实施与运维的硬底座。', '["Linux","运维","服务器"]'],
  [6003, 'barcode-rfid', '条码 / RFID 与自动识别', '条码、RFID、PDA、绑定逻辑，物料与成品唯一身份的起点。', '["条码","RFID","自动识别"]'],
  [6004, 'project-management', '项目管理与实施方法论', '调研、蓝图、UAT、上线、验收，一套能落地的实施打法。', '["项目管理","实施","方法论"]'],
  [6005, 'embedded', '嵌入式 · 边缘设备与网关', '单片机、Modbus 组网、边缘网关与 MQTT，连接 OT 与 IT 的最后一米。', '["嵌入式","边缘","网关"]'],
  [6006, 'wms-aps-bi', 'WMS / APS / BI', '仓储、高级排程、数据分析，从物料流动到经营洞察。', '["WMS","APS","BI"]'],
  [6007, 'lean-ie', '精益生产与 IE 基础', '节拍、浪费、标准作业、标准工时，让产线持续提效。', '["精益","IE","效率"]'],
];

// ---- 新 track（id, slug, title, subtitle, kind, icon, summary, sort） ----
const newTracks = [
  [11, 'wms-aps-bi', 'WMS / APS / BI', '仓储 · 排程 · 数据分析', 'core', 'warehouse', '从仓库作业到高级排程与经营分析，打通物料流动与数据洞察。', 11],
  [12, 'lean-ie', '精益生产与 IE 基础', '效率 · 浪费 · 标准作业', 'core', 'workflow', '用工业工程方法识别浪费、建立标准作业，让产线持续提效。', 12],
];

// ---- 新 track_levels（id, track_id, level, name, goal, hours, outcomes, planned_chapters） ----
const newLevels = [
  [111, 11, 1, 'L1 入门', '了解 WMS/APS/BI 各自解决什么问题', 0, '[]', '[]'],
  [112, 11, 2, 'L2 中级', '能讲清三者如何协同支撑计划与执行', 0, '[]', '[]'],
  [113, 11, 3, 'L3 高级', '能基于数据做经营分析与改善提案', 0, '[]', '[]'],
  [121, 12, 1, 'L1 入门', '建立浪费与节拍的基本直觉', 0, '[]', '[]'],
  [122, 12, 2, 'L2 中级', '能设计标准作业与线平衡', 0, '[]', '[]'],
  [123, 12, 3, 'L3 高级', '能主导一个精益改善小项目', 0, '[]', '[]'],
];

// ---- 章节计划（chapterId, file, topicId, levelId, sort, title） ----
// levelId 取自现有 track_levels：industrial-network 61/62/63, linux-ops 71/72/73,
//   barcode-rfid 81/82/83, project-management 91/92/93, embedded 51/52/53,
//   sql 31/32/33；新 track wms-aps-bi 111/112/113, lean-ie 121/122/123
const plan = [
  // 工业网络与通讯（topic 6001）
  [9001, '工业网络与通讯/01_工业以太网基础.md', 6001, 61, 1, '工业以太网基础'],
  [9002, '工业网络与通讯/02_Modbus协议.md', 6001, 61, 2, 'Modbus 协议'],
  [9003, '工业网络与通讯/03_OPC_UA.md', 6001, 62, 1, 'OPC UA'],
  [9004, '工业网络与通讯/04_Profinet.md', 6001, 62, 2, 'Profinet'],
  [9005, '工业网络与通讯/05_交换机与网络规划.md', 6001, 63, 1, '交换机与网络规划'],
  [9006, '工业网络与通讯/06_网关与协议转换.md', 6001, 63, 2, '网关与协议转换'],
  // Linux 与服务器运维（topic 6002）
  [9007, 'Linux与服务器运维/01_Linux基础.md', 6002, 71, 1, 'Linux 基础'],
  [9008, 'Linux与服务器运维/02_常用命令.md', 6002, 71, 2, '常用命令'],
  [9009, 'Linux与服务器运维/03_服务部署.md', 6002, 72, 1, '服务部署'],
  [9010, 'Linux与服务器运维/04_网络排查.md', 6002, 72, 2, '网络排查'],
  [9011, 'Linux与服务器运维/05_备份与容灾.md', 6002, 73, 1, '备份与容灾'],
  // 条码 / RFID 与自动识别（topic 6003）
  [9012, '条码RFID与自动识别/01_条码基础.md', 6003, 81, 1, '条码基础'],
  [9013, '条码RFID与自动识别/02_RFID.md', 6003, 81, 2, 'RFID'],
  [9014, '条码RFID与自动识别/03_手持终端PDA.md', 6003, 82, 1, '手持终端 PDA'],
  [9015, '条码RFID与自动识别/04_绑定逻辑.md', 6003, 82, 2, '绑定逻辑'],
  // 项目管理与实施方法论（topic 6004）
  [9016, '项目管理与实施方法论/01_项目调研.md', 6004, 91, 1, '项目调研'],
  [9017, '项目管理与实施方法论/02_蓝图设计.md', 6004, 91, 2, '蓝图设计'],
  [9018, '项目管理与实施方法论/03_UAT用户测试.md', 6004, 92, 1, 'UAT 用户测试'],
  [9019, '项目管理与实施方法论/04_上线切换.md', 6004, 92, 2, '上线切换'],
  [9020, '项目管理与实施方法论/05_验收与交付.md', 6004, 93, 1, '验收与交付'],
  // 嵌入式（topic 6005）—— L3 已有 chapter 80（来自 PLC 文件夹）
  [9021, '嵌入式/01_单片机基础.md', 6005, 51, 1, '单片机基础'],
  [9022, '嵌入式/02_Modbus组网.md', 6005, 52, 1, 'Modbus 组网'],
  [9023, '嵌入式/03_边缘网关与MQTT.md', 6005, 52, 2, '边缘网关与 MQTT'],
  // SQL 补充（topic 6 已存在：数据库基础→L1，3 篇实战→L2）
  [9024, 'SQL/01_数据库基础.md', 6, 31, 0, '数据库基础'],
  [9025, 'SQL/06_实战_生产报表.md', 6, 32, 11, '实战：生产报表'],
  [9026, 'SQL/07_实战_质量分析.md', 6, 32, 12, '实战：质量分析'],
  [9027, 'SQL/08_实战_追溯查询.md', 6, 32, 13, '实战：追溯查询'],
  // WMS / APS / BI（track 11, topic 6006）
  [9028, 'WMS_APS_BI/01_WMS仓储管理.md', 6006, 111, 1, 'WMS 仓储管理'],
  [9029, 'WMS_APS_BI/02_APS高级排程.md', 6006, 112, 1, 'APS 高级排程'],
  [9030, 'WMS_APS_BI/03_数据分析与BI.md', 6006, 113, 1, '数据分析与 BI'],
  // 精益生产与 IE 基础（track 12, topic 6007）
  [9031, '精益生产与IE基础/01_节拍与线平衡.md', 6007, 121, 1, '节拍与线平衡'],
  [9032, '精益生产与IE基础/02_七大浪费.md', 6007, 121, 2, '七大浪费'],
  [9033, '精益生产与IE基础/03_标准作业SOP.md', 6007, 122, 1, '标准作业 SOP'],
  [9034, '精益生产与IE基础/04_标准工时.md', 6007, 122, 2, '标准工时'],
];

let sql = `-- 脑库 10_Learning 缺口模块 + 2 新模块 导入（生成 ${new Date().toISOString()}）
-- 章节 9001-9034 / topic 6001-6007 / track 11-12 / level 111-113,121-123
-- 全部 INSERT OR IGNORE，可重复执行。

`;
for (const [id, slug, title, desc, modules] of newTopics) {
  sql += `INSERT OR IGNORE INTO topics (id, slug, title, description, modules, status, created_at, updated_at) VALUES (${id}, '${slug}', '${esc(title)}', '${esc(desc)}', '${modules}', 'published', ${now}, ${now});\n`;
}
sql += '\n';
for (const [id, slug, title, subtitle, kind, icon, summary, sort] of newTracks) {
  sql += `INSERT OR IGNORE INTO tracks (id, slug, title, subtitle, kind, icon, summary, sort, status) VALUES (${id}, '${slug}', '${esc(title)}', '${esc(subtitle)}', '${kind}', '${icon}', '${esc(summary)}', ${sort}, 'published');\n`;
}
sql += '\n';
for (const [id, tid, level, name, goal, hours, outcomes, planned] of newLevels) {
  sql += `INSERT OR IGNORE INTO track_levels (id, track_id, level, name, goal, hours, outcomes, planned_chapters) VALUES (${id}, ${tid}, ${level}, '${esc(name)}', '${esc(goal)}', ${hours}, '${outcomes}', '${planned}');\n`;
}
sql += '\n';

let n = 0;
for (const [cid, file, topicId, levelId, sort, title] of plan) {
  const body = bodyOf(file);
  sql += `INSERT OR IGNORE INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (${cid}, ${topicId}, '${esc(title)}', ${sort}, 'published', '${esc(body)}', 1, ${now});\n`;
  sql += `INSERT OR IGNORE INTO track_level_chapters (level_id, chapter_id) VALUES (${levelId}, ${cid});\n`;
  n++;
}

writeFileSync(join(ROOT, 'worker', 'public', 'import-brainlib-gap.sql'), sql, 'utf-8');
console.log(`✓ 生成 worker/public/import-brainlib-gap.sql —— ${n} 章 + ${newTopics.length} topic + ${newTracks.length} track + ${newLevels.length} level`);
