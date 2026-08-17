import { describe, it, expect } from 'vitest';
import { callApi, expectEnvelope } from '../helpers/client';
import { getAdminCookie } from '../helpers/auth';

// L2 功能层 —— 认证模块全链路（对应生产鉴权逻辑）。
describe('L2 认证模块', () => {
  it('错误口令 → 401 (2001)', async () => {
    const { res, json } = await callApi('POST', '/api/v1/auth/login', {
      body: { username: 'a', password: 'wrong' },
    });
    expect(res.status).toBe(401);
    expect(json!.code).toBe(2001);
  });

  it('正确口令 → 200 且下发 sid cookie', async () => {
    const { res } = await callApi('POST', '/api/v1/auth/login', {
      body: { username: 'tester', password: 'qijia2002' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/sid=/);
  });

  it('whoami 无会话 → 401；有会话 → 200 返回 sub', async () => {
    const noAuth = await callApi('GET', '/api/v1/auth/whoami');
    expect(noAuth.res.status).toBe(401);

    const cookie = await getAdminCookie();
    const ok = await callApi('GET', '/api/v1/auth/whoami', { cookie });
    expect(ok.res.status).toBe(200);
    expectEnvelope(ok.json);
    expect((ok.json!.data as { sub: string }).sub).toBeTruthy();
  });

  it('登出 → 200 且清空 cookie', async () => {
    const cookie = await getAdminCookie();
    const { res } = await callApi('POST', '/api/v1/auth/logout', { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/sid=;/);
  });
});
