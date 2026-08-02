import type { Handler, Middleware } from './core/context';
import { compose } from './core/pipeline';
import { errorBoundary } from './middleware/errorBoundary';
import { trace } from './middleware/trace';
import { security } from './middleware/security';
import { auth, guardAdmin, guardAll } from './middleware/auth';
import { validate } from './middleware/validate';
import { loginRateLimit } from './middleware/ratelimit';

import { healthHandler } from './modules/health';
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
  gradeAnswer,
  aiGrade,
  getSqlExercise,
  listSqlExercises,
  submitSql,
} from './modules/quiz/quiz.routes';
import { listLp, getLp } from './modules/learning-paths/lp.routes';
import { listCert } from './modules/certifications/cert.routes';

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

export const routes: Route[] = [
  { method: 'GET', path: '/api/v1/health', handler: healthHandler, noAuth: true },

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

  // 只读内容链路（走 L2 缓存）
  { method: 'GET', path: '/api/v1/topics', handler: listTopics },
  // :id 兼容数字 id 与 slug
  { method: 'GET', path: '/api/v1/topics/:id', handler: getTopic },
  { method: 'GET', path: '/api/v1/topics/:id/chapters', handler: listChapters },
  { method: 'GET', path: '/api/v1/chapters/:id', handler: getChapter },

  // Phase 0.5 进度
  { method: 'POST', path: '/api/v1/progress', handler: recordProgress },
  { method: 'GET', path: '/api/v1/progress', handler: listProgress },
  { method: 'GET', path: '/api/v1/progress/today', handler: todayProgress },

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
  { method: 'GET', path: '/api/v1/quiz/questions', handler: listQuestions },
  { method: 'GET', path: '/api/v1/quiz/topic-questions', handler: listTopicQuestions },
  { method: 'POST', path: '/api/v1/quiz/grade', handler: gradeAnswer, noAuth: true },
  { method: 'POST', path: '/api/v1/quiz/ai-grade', handler: aiGrade, noAuth: true },
  { method: 'GET', path: '/api/v1/sql-exercises', handler: listSqlExercises },
  { method: 'GET', path: '/api/v1/sql-exercises/:id', handler: getSqlExercise },
  { method: 'POST', path: '/api/v1/sql-exercises/:id/submit', handler: submitSql },

  // Phase 3 学习路径 / 证书
  { method: 'GET', path: '/api/v1/learning-paths', handler: listLp },
  { method: 'GET', path: '/api/v1/learning-paths/:id', handler: getLp },
  { method: 'GET', path: '/api/v1/certifications', handler: listCert },
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
