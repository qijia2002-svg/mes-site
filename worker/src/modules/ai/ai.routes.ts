import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';

/**
 * POST /api/v1/ai/study-tip —— Workers AI 生成一句话中文学习建议。
 *
 * 设计：
 *  - 入参是「学习进度摘要」（客户端组装，不含敏感信息），因此匿名可用（noAuth）。
 *  - 复用已验证的 @cf/meta/llama-3.2-3b-instruct；AI 调用失败或返回空时返回兜底建议，
 *    绝不让前端因此报错（与 ai-grade 一致的"AI 不可用也不阻断"原则）。
 */
const MODEL = '@cf/meta/llama-3.2-3b-instruct';

interface TipInput {
  doneChapters: number;
  totalChapters: number;
  currentTopic: string;
  streakDays: number;
  needReview: boolean;
  reviewTopic: string;
}

const FALLBACK_TIPS = [
  '每天固定时段学一章，比突击更高效。',
  '把刚学的工序画成流程图，记得更牢。',
  '遇到不懂的 SQL，先在沙盒里跑一遍再回头看讲解。',
];

function parseInput(b: Record<string, unknown>): TipInput {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : '');
  return {
    doneChapters: num(b.doneChapters),
    totalChapters: num(b.totalChapters),
    currentTopic: str(b.currentTopic),
    streakDays: num(b.streakDays),
    needReview: b.needReview === true,
    reviewTopic: str(b.reviewTopic),
  };
}

function pickFallback(): string {
  return FALLBACK_TIPS[Math.floor(Math.random() * FALLBACK_TIPS.length)];
}

function buildPrompt(inp: TipInput): string {
  const reviewPart = inp.needReview
    ? `需要复习（建议复习《${inp.reviewTopic || '已学内容'}》）`
    : '暂不需要复习';
  return [
    '你是 MES 数字化学习平台的 AI 教练。根据学员进度，用一句中文（不超过 40 字）给出具体、鼓励的学习建议。只输出建议本身，不要解释、不要 markdown、不要引号。',
    '',
    `学员情况：已学 ${inp.doneChapters}/${inp.totalChapters} 章；当前在学《${inp.currentTopic || '基础课程'}》；连续学习 ${inp.streakDays} 天；${reviewPart}。`,
  ].join('\n');
}

function clean(s: string): string {
  return s
    .replace(/^["'【】\s]+|["'】\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function studyTip(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  const inp = parseInput(body);

  try {
    const resp = await c.env.AI.run(MODEL, { prompt: buildPrompt(inp), temperature: 0.6 });
    const raw =
      typeof (resp as { response?: unknown }).response === 'string'
        ? (resp as { response: string }).response
        : '';
    const tip = clean(raw) || pickFallback();
    return ok(c, { tip });
  } catch (e) {
    c.log.error({ msg: 'ai study-tip failed', err: String(e) });
    return ok(c, { tip: pickFallback() });
  }
}

/**
 * POST /api/v1/ai/explain-word —— Workers AI 生成英文单词的结构化翻译/解释卡。
 *
 * 返回字段（全部可选兜底，绝不让前端因字段缺失报错）：
 *  - word      原词（回显）
 *  - pos       词性缩写，如 "v." / "n." / "prep."
 *  - zh        中文释义（短）
 *  - example   英文例句（尽量 SQL/编程用法）
 *  - exampleZh 例句中文译文
 *  - category  2-4 字中文分类标签，如 "查询"
 *  - detail    一句话中文详解
 *
 * 设计：
 *  - 匿名可用（noAuth），客户端只发一个单词，无敏感信息。
 *  - 离线兜底词典优先：常见 SQL 关键字即时、稳定、零 AI 成本（用户首批用例就是 SELECT 等）。
 *  - AI 调用失败或返回无法解析 → 退化到本地词典/兜底提示，绝不让前端报错（与 study-tip 一致）。
 */
interface WordResult {
  word: string;
  pos: string;
  zh: string;
  example: string;
  exampleZh: string;
  category: string;
  detail: string;
}

/** 离线兜底词典：覆盖常见 SQL/数据库关键字，结果稳定且即时，无需调 AI。 */
const LOCAL_DICT: Record<string, Omit<WordResult, 'word'>> = {
  SELECT: { pos: 'v.', zh: '从数据库中查询数据', example: 'SELECT * FROM table', exampleZh: '从表中选择所有数据', category: '查询', detail: 'SELECT 是数据库查询语句的关键字，用于从数据库中获取数据。' },
  FROM: { pos: 'prep.', zh: '指定数据的来源表', example: 'SELECT * FROM users', exampleZh: '从 users 表中查询所有记录', category: '数据来源', detail: 'FROM 后接要查询的表名，是 SELECT 语句的数据来源。' },
  TABLE: { pos: 'n.', zh: '表，数据库中按行列组织的二维数据集合', example: 'CREATE TABLE orders (id INT)', exampleZh: '创建一张名为 orders 的表', category: '数据对象', detail: '表是关系型数据库存储数据的基本单位，由行（记录）和列（字段）组成。' },
  QUERY: { pos: 'n. / v.', zh: '查询；向数据库发起的检索请求', example: 'Run a query to fetch records', exampleZh: '执行一次查询以获取记录', category: '查询', detail: 'query 既可作名词（一条查询语句），也可作动词（执行查询）。' },
  WHERE: { pos: 'conj.', zh: '条件过滤，只返回满足条件的行', example: 'SELECT * FROM t WHERE id = 1', exampleZh: '只查 id 等于 1 的行', category: '条件', detail: 'WHERE 子句用于筛选记录，支持 =、>、LIKE 等条件。' },
  JOIN: { pos: 'v.', zh: '连接多张表，按关联字段合并结果', example: 'JOIN orders ON orders.user_id = users.id', exampleZh: '按 user_id 关联订单与用户', category: '关联', detail: 'JOIN 用于把多张相关表的数据按关联键拼成一张结果集。' },
  INSERT: { pos: 'v.', zh: '向表中插入新记录', example: 'INSERT INTO t (name) VALUES ("A")', exampleZh: '向表 t 插入一条 name 为 A 的记录', category: '写入', detail: 'INSERT 用于新增数据行，需配合 VALUES 提供字段值。' },
  UPDATE: { pos: 'v.', zh: '更新表中已有记录', example: 'UPDATE t SET x = 1 WHERE id = 1', exampleZh: '把 id 为 1 的记录的 x 改为 1', category: '修改', detail: 'UPDATE 修改满足条件的行，通常必须带 WHERE 否则全表更新。' },
  DELETE: { pos: 'v.', zh: '删除表中的记录', example: 'DELETE FROM t WHERE id = 1', exampleZh: '删除 id 为 1 的记录', category: '删除', detail: 'DELETE 删除满足条件的行，务必加 WHERE 以免清空整张表。' },
  INDEX: { pos: 'n.', zh: '索引，加速查询的数据库结构', example: 'CREATE INDEX idx ON t(col)', exampleZh: '在 t 表的 col 列上建索引', category: '性能', detail: '索引像书的目录，能大幅加快按该列的查询速度，但会占用存储。' },
  DATABASE: { pos: 'n.', zh: '数据库，有组织地存储和管理数据的系统', example: 'Connect to the database', exampleZh: '连接到数据库', category: '存储', detail: '数据库用于持久化存储结构化数据，常见如 MySQL、PostgreSQL。' },
  VALUE: { pos: 'n.', zh: '值，字段中存储的具体数据', example: 'SET value = 10', exampleZh: '把 value 设为 10', category: '数据', detail: 'value 指某个字段或变量当前保存的具体数据内容。' },
};

function pickLocal(word: string): WordResult | null {
  const key = word.trim().toUpperCase();
  const hit = LOCAL_DICT[key];
  return hit ? { word: key, ...hit } : null;
}

/** 从模型原文中抽取可能的 JSON（容忍 markdown 代码块与前后废话）。 */
function extractJson(s: string): Partial<WordResult> | null {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : s).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Partial<WordResult>;
  } catch {
    return null;
  }
}

function strOf(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function toResult(word: string, raw: Partial<WordResult> | null): WordResult {
  const zh = strOf(raw?.zh);
  const example = strOf(raw?.example);
  if (!zh && !example) {
    return {
      word,
      pos: '',
      zh: '暂时无法解析该单词，请检查拼写或稍后再试。',
      example: '',
      exampleZh: '',
      category: '未知',
      detail: '',
    };
  }
  return {
    word,
    pos: strOf(raw?.pos, 12),
    zh,
    example,
    exampleZh: strOf(raw?.exampleZh),
    category: strOf(raw?.category, 8) || '单词',
    detail: strOf(raw?.detail, 80),
  };
}

function buildWordPrompt(word: string): string {
  return [
    `你是 MES 数字化学习平台的英文词典助手。请解释英文单词"${word}"，优先结合数据库 / SQL / 编程场景（若适用）。`,
    '只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块。字段定义：',
    '- pos: 词性缩写，如 "v." "n." "prep." "conj." "adj." "adv."',
    '- zh: 简洁中文释义，不超过 30 个汉字',
    '- example: 一句英文例句（尽量是 SQL / 编程用法），不超过 50 个字符',
    '- exampleZh: 该例句的中文翻译，不超过 40 个汉字',
    '- category: 2-4 字中文分类标签，如 "查询" "数据对象" "条件" "写入"',
    '- detail: 一句中文详解，不超过 50 个汉字',
    '示例：{"pos":"v.","zh":"从数据库中查询数据","example":"SELECT * FROM table","exampleZh":"从表中选择所有数据","category":"查询","detail":"SELECT 是数据库查询语句的关键字，用于从数据库中获取数据。"}',
  ].join('\n');
}

export async function explainWord(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  const wordRaw = typeof body.word === 'string' ? body.word.trim() : '';
  if (!wordRaw) return fail(c, Err.paramMissing());
  const word = wordRaw.slice(0, 40);

  // 1) 离线兜底词典优先（SQL 关键字即时、稳定、零成本）
  const local = pickLocal(word);
  if (local) return ok(c, local);

  // 2) 调 Workers AI 生成结构化解释
  try {
    const resp = await c.env.AI.run(MODEL, { prompt: buildWordPrompt(word), temperature: 0.3 });
    const raw =
      typeof (resp as { response?: unknown }).response === 'string'
        ? (resp as { response: string }).response
        : '';
    const parsed = extractJson(raw);
    if (parsed) return ok(c, toResult(word, parsed));
  } catch (e) {
    c.log.error({ msg: 'ai explain-word failed', word, err: String(e) });
  }

  // 3) 最终兜底：本地词典（按大写再试一次）+ 通用提示
  const retryLocal = pickLocal(word);
  if (retryLocal) return ok(c, retryLocal);
  return ok(c, {
    word,
    pos: '',
    zh: '暂时无法解析该单词，请检查拼写或稍后再试。',
    example: '',
    exampleZh: '',
    category: '未知',
    detail: '',
  });
}
