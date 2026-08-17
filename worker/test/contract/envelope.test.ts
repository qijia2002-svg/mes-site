import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { routes } from '../../src/router';
import { callApi, expectEnvelope } from '../helpers/client';

// L1 契约与信封层：保证"统一信封 + 错误码分区 + 契约对齐"不被回归破坏。
describe('L1 契约与信封', () => {
  it('路由登记表完整：无重复、均有 handler、method 合法', () => {
    const seen = new Set<string>();
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      expect(seen.has(key), `重复路由: ${key}`).toBe(false);
      seen.add(key);
      expect(typeof r.handler).toBe('function');
      expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(r.method);
    }
    // 当前 router 实际登记 63 条；若大幅减少说明有人误删路由
    expect(routes.length, '路由数量异常减少，可能存在误删').toBeGreaterThan(50);
  });

  it('成功响应统一信封 {code:0, data, msg, traceId}', async () => {
    const { res, json } = await callApi('GET', '/api/v1/health');
    expect(res.status).toBe(200);
    expect(json!.code).toBe(0);
    expect(json!).toHaveProperty('data');
    expectEnvelope(json);
  });

  it('未知路由返回信封化 404（含 traceId）', async () => {
    const { res, json } = await callApi('GET', '/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(json!.code).toBe(404);
    expect(json!.data).toBeNull();
    expect(typeof json!.traceId).toBe('string');
  });

  it('openapi 文档无过期路径（防文档漂移回归）', () => {
    const raw = readFileSync(
      new URL('../../../docs/api/openapi.yaml', import.meta.url),
      'utf-8',
    );
    // 提取 openapi 中声明的路径（形如 "  /api/v1/health:"）
    const docPaths = [...raw.matchAll(/^ {2}(\/api\/\S+):/gm)].map((m) =>
      m[1].replace(/\{(\w+)\}/g, ':$1'),
    );
    const actual = new Set(routes.map((r) => r.path));
    const stale = docPaths.filter((p) => !actual.has(p));
    expect(stale, `openapi 存在 router 中已不存在的路径: ${stale.join(', ')}`).toEqual([]);

    const covered = docPaths.filter((p) => actual.has(p)).length;
    // 当前契约覆盖率约 1/3；此用例只防"回归"，覆盖率提升见阶段 3 硬卡点
    console.log(
      `[契约覆盖率] openapi ${covered}/${actual.size} 实际路由 —— 其余需在 docs/api/openapi.yaml 补全`,
    );
  });
});
