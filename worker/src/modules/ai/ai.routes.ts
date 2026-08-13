import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { guardedAiRun } from '../../core/ai-guard';
import { dictRepo } from '../../data/repositories/dict.repo';
import {
  buildTutorPrompt,
  detectTutorCommand,
  type TutorContext,
  type TutorTurn,
} from './mesTutor.prompt';

/**
 * AI 模块（study-tip / explain-word / tts / tutor）
 *
 * 全部 AI 调用统一经 core/ai-guard 的 guardedAiRun：
 *  - 5s 超时、受限重试、单路由熔断、日预算软告警、Bot 异常检测、结构化遥测。
 *  - 业务兜底（静态提示 / D1 词典 / {audio:''} / 导师兜底文案）仍在此处处理，护栏只负责安全与成本。
 *
 * 路由 key 约定：ai:study-tip / ai:explain-word / ai:tts / ai:tutor
 */

const MODEL = '@cf/meta/llama-3.2-3b-instruct';
const TTS_MODEL = '@cf/myshell-ai/melotts';

/* ============================ study-tip ============================ */

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

function parseTipInput(b: Record<string, unknown>): TipInput {
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

function buildTipPrompt(inp: TipInput): string {
  const reviewPart = inp.needReview
    ? `需要复习（建议复习《${inp.reviewTopic || '已学内容'}》）`
    : '暂不需要复习';
  return [
    '你是 MES 数字化学习平台的 AI 教练。根据学员进度，用一句中文（不超过 40 字）给出具体、鼓励的学习建议。只输出建议本身，不要解释、不要 markdown、不要引号。',
    '',
    `学员情况：已学 ${inp.doneChapters}/${inp.totalChapters} 章；当前在学《${inp.currentTopic || '基础课程'}》；连续学习 ${inp.streakDays} 天；${reviewPart}。`,
  ].join('\n');
}

function cleanTip(s: string): string {
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
  const inp = parseTipInput(body);

  const { result, telemetry } = await guardedAiRun(c.env, {
    route: 'ai:study-tip',
    models: [MODEL],
    input: { prompt: buildTipPrompt(inp), temperature: 0.6 },
    log: c.log,
  });

  let tip = pickFallback();
  if (telemetry.ok && result) {
    const raw =
      typeof (result as { response?: unknown }).response === 'string'
        ? (result as { response: string }).response
        : '';
    tip = cleanTip(raw) || pickFallback();
  }
  return ok(c, { tip });
}

/* ============================ explain-word ============================ */

interface WordResult {
  word: string;
  pos: string;
  zh: string;
  example: string;
  exampleZh: string;
  category: string;
  detail: string;
}

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

function extractMeaningFromText(raw: string): string {
  if (!raw) return '';
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`>]/g, ' ')
    .replace(/[A-Za-z0-9_]+/g, ' ');
  const patterns = [
    /(?:中文|释义|解释|含义|意思|说明)[：:]\s*([一-龥]{2,40})/,
    /(?:意思是|即|指|表示)\s*([一-龥]{2,40})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  const cn = text.match(/[一-龥]{4,40}/);
  return cn ? cn[0].trim() : '';
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
    `你是 MES 数字化学习平台的英文词典助手。请解释英文单词或缩写"${word}"，优先结合数据库 / SQL / 编程 / 制造场景（若适用）。`,
    '只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块。字段定义：',
    '- pos: 词性缩写，如 "v." "n." "prep." "conj." "adj." "adv."',
    '- zh: 简洁中文释义，不超过 30 个汉字',
    '- example: 一句英文例句（尽量是 SQL / 编程 / 制造用法），不超过 50 个字符',
    '- exampleZh: 该例句的中文翻译，不超过 40 个汉字',
    '- category: 2-4 字中文分类标签，如 "查询" "数据对象" "条件" "写入" "制造" "质量"',
    '- detail: 一句中文详解，不超过 50 个汉字',
    '重要：即使是极常见的英文单词（如 order、inventory、lead time），也必须给出它在数据库 / 制造 / SQL / 编程语境下最贴切的中文释义，不要说"太常见"或拒绝解释。',
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

  // 1) 云端词典优先（D1，即时、稳定、零 AI 成本，覆盖绝大多数行业缩写）
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

  // 2) AI 兜底（生僻词）：经护栏调用，单请求硬限 1 次，杜绝原"0.1→0"双倍计费
  const { result, telemetry } = await guardedAiRun(c.env, {
    route: 'ai:explain-word',
    models: [MODEL],
    input: { prompt: buildWordPrompt(word), temperature: 0.1 },
    log: c.log,
    maxCallsPerRequest: 1,
  });

  if (telemetry.ok && result) {
    const raw =
      typeof (result as { response?: unknown }).response === 'string'
        ? (result as { response: string }).response
        : '';
    const parsed = extractJson(raw);
    if (parsed && (parsed.zh || parsed.example)) return ok(c, toResult(word, parsed));
    const freeZh = extractMeaningFromText(raw);
    if (freeZh) {
      return ok(c, { word, pos: '', zh: freeZh, example: '', exampleZh: '', category: 'AI', detail: '' });
    }
  }

  // 3) 最终兜底：通用提示（绝不因 AI 不可用而让前端报错）
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

/* ============================ tts ============================ */

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

  const { result, telemetry } = await guardedAiRun(c.env, {
    route: 'ai:tts',
    models: [TTS_MODEL],
    input: { prompt: text, lang },
    log: c.log,
    maxCallsPerRequest: 1,
  });

  const audio =
    telemetry.ok && result && typeof (result as { audio?: unknown }).audio === 'string'
      ? (result as { audio: string }).audio
      : '';
  return ok(c, { audio });
}

/* ============================ tutor ============================ */

const TUTOR_MAX_INPUT = 600;
const TUTOR_FALLBACK =
  '导师暂时无法回答，请稍后再试；或输入 /plan 获取当前主题的学习路线图，输入 /help 查看全部命令。';

interface TutorBody {
  message?: unknown;
  topic?: unknown;
  chapter?: unknown;
  term?: unknown;
  stage?: unknown;
  history?: unknown;
}

function parseTutorHistory(raw: unknown): TutorTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: TutorTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const role = o.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof o.content === 'string' ? o.content.trim().slice(0, 300) : '';
    if (content) out.push({ role, content });
    if (out.length >= 8) break;
  }
  return out;
}

function toTutorContext(b: TutorBody): TutorContext {
  return {
    topic: strOf(b.topic, 60),
    chapter: strOf(b.chapter, 60),
    term: strOf(b.term, 40),
    stage: strOf(b.stage, 40),
  };
}

export async function tutor(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as TutorBody | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return fail(c, Err.paramMissing());

  const prompt = buildTutorPrompt(
    message.slice(0, TUTOR_MAX_INPUT),
    toTutorContext(body),
    parseTutorHistory(body.history),
  );

  const { result, telemetry } = await guardedAiRun(c.env, {
    route: 'ai:tutor',
    models: [MODEL],
    input: { prompt, temperature: 0.3, max_tokens: 512 },
    log: c.log,
    maxCallsPerRequest: 1,
  });

  let reply = '';
  if (telemetry.ok && result) {
    const raw =
      typeof (result as { response?: unknown }).response === 'string'
        ? (result as { response: string }).response
        : '';
    reply = raw.trim();
  }

  return ok(c, {
    reply: reply || TUTOR_FALLBACK,
    command: detectTutorCommand(message),
  });
}
