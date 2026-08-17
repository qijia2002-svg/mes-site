import { describe, it, expect } from 'vitest';
import { callApi, expectEnvelope } from '../helpers/client';

// L2 功能层 —— 内容模块 happy path + 边界（对应生产 content 路由）。
describe('L2 内容模块', () => {
  it('GET /api/v1/topics → 200 数组且非空', async () => {
    const { res, json } = await callApi('GET', '/api/v1/topics');
    expect(res.status).toBe(200);
    expect(json!.code).toBe(0);
    expectEnvelope(json);
    expect(Array.isArray(json!.data)).toBe(true);
    expect((json!.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('GET /api/v1/topics/1 → 200 含 title', async () => {
    const { res, json } = await callApi('GET', '/api/v1/topics/1');
    expect(res.status).toBe(200);
    expect((json!.data as { title: string }).title).toBeTruthy();
  });

  it('GET /api/v1/topics/999999（不存在）→ 404 (4001)', async () => {
    const { res, json } = await callApi('GET', '/api/v1/topics/999999');
    expect(res.status).toBe(404);
    expect(json!.code).toBe(4001);
  });

  it('GET /api/v1/topics/abc（非数字）→ 安全状态码，不 500', async () => {
    const { res } = await callApi('GET', '/api/v1/topics/abc');
    expect(res.status, '非数字 slug 不得触发 500').not.toBe(500);
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/v1/topics/abc/chapters（非数字）→ 400 (1001)', async () => {
    const { res, json } = await callApi('GET', '/api/v1/topics/abc/chapters');
    expect(res.status).toBe(400);
    expect(json!.code).toBe(1001);
  });

  it('GET /api/v1/topics/1/chapters → 200 数组且非空', async () => {
    const { res, json } = await callApi('GET', '/api/v1/topics/1/chapters');
    expect(res.status).toBe(200);
    expect(Array.isArray(json!.data)).toBe(true);
    expect((json!.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('GET /api/v1/chapters/1 → 200；/chapters/abc → 400', async () => {
    const ok = await callApi('GET', '/api/v1/chapters/1');
    expect(ok.res.status).toBe(200);

    const bad = await callApi('GET', '/api/v1/chapters/abc');
    expect(bad.res.status).toBe(400);
    expect(bad.json!.code).toBe(1001);
  });
});
