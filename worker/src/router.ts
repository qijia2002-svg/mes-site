import type { Handler, Middleware } from './core/context';
import { compose } from './core/pipeline';
import { errorBoundary } from './middleware/errorBoundary';
import { trace } from './middleware/trace';
import { security } from './middleware/security';
import { auth, guardAdmin, guardAll } from './middleware/auth';
import { validate } from './middleware/validate';
import { loginRateLimit, ratelimit } from './middleware/ratelimit';

import { healthHandler, netinfoHandler } from './modules/health';
import { listTopics, getTopic, listChapters, getChapter } from './modules/content/content.routes';
import { loginHandler, logoutHandler, whoamiHandler } from './modules/auth/auth.routes';
import { recordProgress, listProgress, todayProgress } from './modules/progress/progress.routes';
import {
  listTopics as adminListTopics,
  getTopic as adminGetTopic,
  createTopic,
  updateTopic,
  deleteTopic,
  listChapters as adminListChapters,
  getChapter as adminGetChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  importStart,
  importChunk,
  importCommit,
  importContent,
} from './modules/admin/admin.routes';
import {
  listQuestions,
  listTopicQuestions,
  getQuestion,
  gradeAnswer,
  aiGrade,
  getSqlExercise,
  listSqlExercises,
  submitSql,
} from './modules/quiz/quiz.routes';
import { listLp, getLp } from './modules/learning-paths/lp.routes';
import { listCert } from './modules/certifications/cert.routes';
import { engineStatusHandler } from './modules/engine/engine.routes';
import { listTracks, getTrack, listCareers, getCareer, getRoadmapGraph } from './modules/roadmap/roadmap.routes';
import { studyTip, explainWord, tts } from './modules/ai/ai.routes';
import { getUserData, putUserData } from './modules/userdata/userdata.routes';
import {
  getDict,
  createDictType,
  updateDictType,
  deleteDictType,
  createDictData,
  updateDictData,
  deleteDictData,
} from './modules/dict/dict.routes';
import { getFlowchart } from './modules/flowchart/flowchart.routes';
import { getMicroPractice, gradeMicroPractice } from './modules/learn/learn.routes';

export interface Route {
  method: string;
  path: string;
  /** 覆盖默认中间件（如登录接口的先限流后验密） */
  middlewares?: Middleware[];
  handler: Handler;
  admin?: boolean;
  /** 无需登录（health / login / whoami） */
  noAuth?: boolean;
}

/** 可选登录管线：解析会话但不拦截匿名（进度按未登录处理，API §0.2） */
const optionalAuth: Middleware[] = [trace, security, auth, validate];

/** 通用写接口限流：每 IP 5/s，桶容量 10 */
const writeLimit = ratelimit({ key: (c) => c.req.headers.get('cf-connecting-ip') ?? 'unknown', capacity: 10, refillPerSec: 5 });
/** AI 接口限流：每 IP 1/s，桶容量 3 */
const aiLimit = ratelimit({ key: (c) => c.req.headers.get('cf-connecting-ip') ?? 'unknown', capacity: 3, refillPerSec: 1 });

export const routes: Route[] = [
  { method: 'GET', path: '/api/v1/health', handler: healthHandler, noAuth: true },

  // 网络自检页：手机打不开站点时，用能打开的入口访问这里看实际连接信息。
  // 刻意不挂 security——地址栏直接访问是导航请求，不带 Origin，同源校验会
  // 直接拒掉，那这页就永远打不开了。只读连接元数据，不碰 DB、不出业务数据。
  { method: 'GET', path: '/api/v1/netinfo', middlewares: [trace, validate], handler: netinfoHandler, noAuth: true },

  // 认证：登录/登出/身份查询
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    middlewares: [trace, security, loginRateLimit, validate],
    handler: loginHandler,
    noAuth: true,
  },
  { method: 'POST', path: '/api/v1/auth/logout', handler: logoutHandler },
  { method: 'GET', path: '/api/v1/auth/whoami', handler: whoamiHandler },

  // 只读内容链路（走 L2 缓存，公开目录，未登录也能看结构）
  { method: 'GET', path: '/api/v1/topics', middlewares: optionalAuth, handler: listTopics },
  // :id 兼容数字 id 与 slug
  { method: 'GET', path: '/api/v1/topics/:id', middlewares: optionalAuth, handler: getTopic },
  { method: 'GET', path: '/api/v1/topics/:id/chapters', middlewares: optionalAuth, handler: listChapters },
  { method: 'GET', path: '/api/v1/chapters/:id', middlewares: optionalAuth, handler: getChapter },

  // Phase 0.5 进度（写挂限流，读可选登录）
  { method: 'POST', path: '/api/v1/progress', middlewares: [trace, security, auth, writeLimit(), validate], handler: recordProgress },
  { method: 'GET', path: '/api/v1/progress', middlewares: optionalAuth, handler: listProgress },
  { method: 'GET', path: '/api/v1/progress/today', middlewares: optionalAuth, handler: todayProgress },

  // Phase 1 后台（admin 管线：auth + guardAdmin）
  { method: 'GET', path: '/api/v1/admin/topics', admin: true, handler: adminListTopics },
  { method: 'POST', path: '/api/v1/admin/topics', admin: true, handler: createTopic },
  { method: 'GET', path: '/api/v1/admin/topics/:id', admin: true, handler: adminGetTopic },
  { method: 'PUT', path: '/api/v1/admin/topics/:id', admin: true, handler: updateTopic },
  { method: 'DELETE', path: '/api/v1/admin/topics/:id', admin: true, handler: deleteTopic },

  { method: 'GET', path: '/api/v1/admin/chapters', admin: true, handler: adminListChapters },
  { method: 'POST', path: '/api/v1/admin/chapters', admin: true, handler: createChapter },
  { method: 'GET', path: '/api/v1/admin/chapters/:id', admin: true, handler: adminGetChapter },
  { method: 'PUT', path: '/api/v1/admin/chapters/:id', admin: true, handler: updateChapter },
  { method: 'DELETE', path: '/api/v1/admin/chapters/:id', admin: true, handler: deleteChapter },

  // Phase 1 Excel 分片导入（两阶段）
  { method: 'POST', path: '/api/v1/admin/import/start', admin: true, handler: importStart },
  { method: 'POST', path: '/api/v1/admin/import/chunk', admin: true, handler: importChunk },
  { method: 'POST', path: '/api/v1/admin/import/commit', admin: true, handler: importCommit },
  { method: 'POST', path: '/api/v1/admin/import/content', admin: true, handler: importContent },

  // Phase 2 题库 / SQL 实训（题面与答案分离，防缓存泄露 R6）
  { method: 'GET', path: '/api/v1/quiz/questions/:id', handler: getQuestion },
  { method: 'GET', path: '/api/v1/quiz/questions', handler: listQuestions },
  { method: 'GET', path: '/api/v1/quiz/topic-questions', handler: listTopicQuestions },
  { method: 'POST', path: '/api/v1/quiz/grade', middlewares: [trace, security, writeLimit(), validate], handler: gradeAnswer, noAuth: true },
  { method: 'POST', path: '/api/v1/quiz/ai-grade', middlewares: [trace, security, aiLimit(), validate], handler: aiGrade, noAuth: true },
  { method: 'GET', path: '/api/v1/sql-exercises', handler: listSqlExercises },
  { method: 'GET', path: '/api/v1/sql-exercises/:id', handler: getSqlExercise },
  { method: 'POST', path: '/api/v1/sql-exercises/:id/submit', middlewares: [trace, security, writeLimit(), validate], handler: submitSql },

  // Phase 3 学习路径 / 证书
  { method: 'GET', path: '/api/v1/learning-paths', middlewares: optionalAuth, handler: listLp },
  { method: 'GET', path: '/api/v1/learning-paths/:id', middlewares: optionalAuth, handler: getLp },
  { method: 'GET', path: '/api/v1/certifications', handler: listCert },

  // 职业路线图（Phase 4，ADR-012）：可选登录——解析会话但不拦截匿名，
  // 否则 noAuth 走 [trace, security, validate] 不跑 auth，登录用户拿不到进度（API §0.2）
  { method: 'GET', path: '/api/v1/tracks', middlewares: optionalAuth, handler: listTracks },
  { method: 'GET', path: '/api/v1/tracks/:slug', middlewares: optionalAuth, handler: getTrack },
  { method: 'GET', path: '/api/v1/careers', middlewares: optionalAuth, handler: listCareers },
  { method: 'GET', path: '/api/v1/careers/:slug', middlewares: optionalAuth, handler: getCareer },
  { method: 'GET', path: '/api/v1/roadmap/graph', middlewares: optionalAuth, handler: getRoadmapGraph },

  // 学习引擎（可选登录：登录用户拿进度，匿名用户全 o pending）
  { method: 'POST', path: '/api/v1/engine/status', middlewares: optionalAuth, handler: engineStatusHandler },

  // 跨设备用户数据 KV（登录隔离：默认管线 auth + guardAll，未登录 401）
  // Issue #2 修复：作品集 / 个人资料 / 引擎状态 / 仿真状态 从 localStorage 迁云端。
  { method: 'GET', path: '/api/v1/user/data/:key', handler: getUserData },
  { method: 'PUT', path: '/api/v1/user/data/:key', handler: putUserData },

  // 工厂流程图（factory-first 导航主干；读取公开）
  { method: 'GET', path: '/api/v1/flowchart/:slug', handler: getFlowchart, noAuth: true },

  // 零基础重学 v1：微练习（SQL 前台阶，计入完成度；判分只在服务端）
  { method: 'GET', path: '/api/v1/micro-practices/:id', handler: getMicroPractice, noAuth: true },
  { method: 'POST', path: '/api/v1/micro-practices/:id/grade', middlewares: [trace, security, writeLimit(), validate], handler: gradeMicroPractice, noAuth: true },

  // 名称翻译 / 专业词典（读取公开，供「名称翻译」页与选中翻译缓存；后台管理 admin）
  { method: 'GET', path: '/api/v1/dict', handler: getDict, noAuth: true },
  { method: 'POST', path: '/api/v1/admin/dict/type', admin: true, handler: createDictType },
  { method: 'PUT', path: '/api/v1/admin/dict/type/:id', admin: true, handler: updateDictType },
  { method: 'DELETE', path: '/api/v1/admin/dict/type/:id', admin: true, handler: deleteDictType },
  { method: 'POST', path: '/api/v1/admin/dict/data', admin: true, handler: createDictData },
  { method: 'PUT', path: '/api/v1/admin/dict/data/:id', admin: true, handler: updateDictData },
  { method: 'DELETE', path: '/api/v1/admin/dict/data/:id', admin: true, handler: deleteDictData },

  // AI 学习建议（匿名可用，进度摘要由客户端组装，失败兜底）
  { method: 'POST', path: '/api/v1/ai/study-tip', handler: studyTip, noAuth: true },

  // AI 英文单词翻译/解释（匿名可用，仅发单词，离线词典兜底 + AI 生成，失败兜底）
  { method: 'POST', path: '/api/v1/ai/explain-word', handler: explainWord, noAuth: true },

  // AI 语音合成兜底（匿名可用）：Web Speech 不可用时前端降级到服务端 TTS
  { method: 'POST', path: '/api/v1/tts', handler: tts, noAuth: true, middlewares: [trace, security, aiLimit(), validate] },
];

/** 默认中间件管线（§A3.2 固定顺序；鉴权在限流前） */
function defaultMiddlewares(route: Route): Middleware[] {
  if (route.noAuth) return [trace, security, validate];
  if (route.admin) return [trace, security, auth, guardAdmin, validate];
  return [trace, security, auth, guardAll, validate];
}

export function buildPipeline(route: Route): Handler {
  const mws = route.middlewares ?? defaultMiddlewares(route);
  return compose([errorBoundary, ...mws], route.handler);
}

/** 静态路由匹配（零正则回溯）。`:name` 段捕获为 params。 */
export function matchRoute(
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const rp = r.path.split('/');
    const pp = pathname.split('/');
    if (rp.length !== pp.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith(':')) {
        params[rp[i].slice(1)] = decodeURIComponent(pp[i]);
      } else if (rp[i] !== pp[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route: r, params };
  }
  return null;
}
