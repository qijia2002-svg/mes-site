import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { dictRepo } from '../../data/repositories/dict.repo';

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
 * POST /api/v1/ai/explain-word —— 英文单词/术语的结构化翻译卡。
 *
 * 返回字段（全部可选兜底，绝不让前端因字段缺失报错）：
 *  - word      原词（回显，大写）
 *  - pos       词性缩写，如 "v." / "n." / "prep."
 *  - zh        中文释义（短）
 *  - example   英文例句（尽量 SQL/编程用法）
 *  - exampleZh 例句中文译文
 *  - category  2-4 字中文分类标签
 *  - detail    一句话中文详解
 *
 * 设计：
 *  - 默认需登录（auth 管线），以便读取云端词典（D1）。
 *  - 云端词典优先：D1 命中即返回，即时、稳定、零 AI 成本（覆盖「名称翻译」全部词条）。
 *  - AI 调用失败或返回无法解析 → 退化到通用兜底提示，绝不让前端报错（与 study-tip 一致）。
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

  // 1) 云端词典优先（D1，即时、稳定、零 AI 成本）
  try {
    const hit = await dictRepo.findByValue(c.db, word);
    if (hit) {
      return ok(c, {
        word: hit.value,
        pos: hit.pos ?? '',
        zh: hit.zh ?? '',
        example: hit.example ?? '',
        exampleZh: hit.example_zh ?? '',
        category: hit.category ?? '',
        detail: hit.detail ?? '',
      });
    }
  } catch (e) {
    c.log.error({ msg: 'dict lookup failed', word, err: String(e) });
  }

  // 2) 调 Workers AI 生成结构化解释（生僻词兜底）
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

  // 3) 最终兜底：通用提示
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

/**
 * POST /api/v1/tts —— Workers AI 语音合成兜底（MeloTTS，多语种）。
 *
 * 前端 useSpeech 优先用浏览器 Web Speech API；在 iOS Safari 等不可靠环境
 * 自动降级到本端点，返回 base64 MP3 由 <audio> 播放，iPhone 也能稳定出声。
 *
 * 设计：
 *  - 匿名可用（noAuth），仅发文本，无敏感信息。
 *  - AI 失败 / 无音频 → 返回 { audio: '' }，前端据此提示"语音暂不可用"，绝不让前端报错。
 *  - 文本上限 500 字符，控制 AI 成本与延迟（$0.0002 / 音频分钟）。
 */
const TTS_MAX = 500;
const TTS_LANG: Record<string, string> = { 'en-US': 'en', 'zh-CN': 'zh', en: 'en', zh: 'zh' };

export async function tts(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return fail(c, Err.paramMissing());
  if (text.length > TTS_MAX) return fail(c, Err.tooLarge());
  const reqLang = typeof body.lang === 'string' ? body.lang : 'en-US';
  const lang = TTS_LANG[reqLang] ?? 'en';
  try {
    const resp = await c.env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang });
    const audio = (resp as { audio?: string }).audio ?? '';
    return ok(c, { audio });
  } catch (e) {
    c.log.error({ msg: 'ai tts failed', err: String(e) });
    return ok(c, { audio: '' });
  }
}
