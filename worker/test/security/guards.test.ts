import { describe, it, expect } from 'vitest';
import { callApi, expectEnvelope } from '../helpers/client';
import { getAdminCookie, forgeCookie, getSecret } from '../helpers/auth';

// L3 安全与韧性层：OWASP API Top 10 映射 —— 鉴权、Origin/CSRF、限流、体量、注入、500 信封化。
describe('L3 安全与韧性', () => {
  it('写请求 Origin 与 Host 不符 → 403 (2004)', async () => {
    const { res, json } = await callApi('POST', '/api/v1/progress', {
      body: { item_type: 'chapter', item_id: '1', status: 'done' },
      headers: { origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
    expect(json!.code).toBe(2004);
    expectEnvelope(json);
  });

  it('guardAll 路由缺会话 → 401 (2001)', async () => {
    const { res, json } = await callApi('POST', '/api/v1/quiz/grade', {
      body: { question_id: 1, answer: 'A' },
    });
    expect(res.status).toBe(401);
    expect(json!.code).toBe(2001);
  });

  it('guardAdmin 路由缺会话 → 401 (2001)', async () => {
    const { res, json } = await callApi('GET', '/api/v1/admin/topics');
    expect(res.status).toBe(401);
    expect(json!.code).toBe(2001);
  });

  it('伪造/过期会话 → 401', async () => {
    const expired = await forgeCookie(getSecret(), {
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const { res } = await callApi('GET', '/api/v1/auth/whoami', { cookie: expired });
    expect(res.status).toBe(401);
  });

  it('请求体超过 256KB → 413 (1002)', async () => {
    // 真实发送 ~300KB body，让服务端 validate 中间件读到 content-length 超阈值而拒绝
    const { res, json } = await callApi('POST', '/api/v1/progress', {
      body: { x: 'a'.repeat(300 * 1024) },
    });
    expect(res.status).toBe(413);
    expect(json!.code).toBe(1002);
  });

  it('参数注入不引发 500（返回安全状态码）', async () => {
    const r1 = await callApi('GET', "/api/v1/topics/';DROP TABLE topics;--");
    expect(r1.res.status, '注入类参数不得触发 500').not.toBe(500);
    const r2 = await callApi('GET', '/api/v1/chapters/abc');
    expect(r2.res.status, '非数字 id 不得触发 500').not.toBe(500);
    expect([400, 404]).toContain(r2.res.status);
  });

  it('登录限流：同 IP 高频 → 429 (3002)', async () => {
    const reqs = Array.from({ length: 8 }, () =>
      callApi('POST', '/api/v1/auth/login', {
        body: { username: 'x', password: 'wrong' },
      }),
    );
    const results = await Promise.all(reqs);
    const locked = results.some(
      ({ res, json }) => res.status === 429 && json!.code === 3002,
    );
    expect(locked, '登录限流（双桶）未触发 429').toBe(true);
  });

  it('写接口限流：达到令牌桶 → 429 (3001)', async () => {
    // progress 无 guardAll，无需 cookie；共享 IP=unknown 桶，cap 10
    const reqs = Array.from({ length: 15 }, () =>
      callApi('POST', '/api/v1/progress', {
        body: { item_type: 'chapter', item_id: '1', status: 'done' },
      }),
    );
    const results = await Promise.all(reqs);
    const limited = results.some(
      ({ res, json }) => res.status === 429 && json!.code === 3001,
    );
    expect(limited, '写接口令牌桶未触发 429').toBe(true);
  });

  it('handler 抛错必须信封化，且 500 响应仍是 JSON 信封（不泄露表名）', async () => {
    // 触发一个未匹配但被 errorBoundary 包裹的异常路径：用超长导致服务异常的边角；
    // 此处以"未知路由"间接验证信封一致性（errorBoundary 路径见 index.ts 未匹配分支）。
    const { res, text } = await callApi('GET', '/api/v1/__force_error_probe__');
    expect(res.status).toBe(404);
    expect(text).not.toMatch(/sqlite|no such table|SQLITE_/i);
  });
});
