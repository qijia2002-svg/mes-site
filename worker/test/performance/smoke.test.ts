import { describe, it, expect } from 'vitest';
import { callApi } from '../helpers/client';

// L4 性能层（本地基线，非 SLA 证明；SLA 级压测见预览环境 k6）。
describe('L4 性能冒烟', () => {
  it('GET /api/v1/health 本地 p95 < 200ms', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await callApi('GET', '/api/v1/health');
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    expect(p95, `p95=${p95.toFixed(1)}ms 超出 200ms 基线`).toBeLessThan(200);
  });

  it('并发 10 × GET /api/v1/topics 全部 200，无 5xx', async () => {
    const res = await Promise.all(
      Array.from({ length: 10 }, () => callApi('GET', '/api/v1/topics')),
    );
    expect(res.every((r) => r.res.status === 200)).toBe(true);
    expect(res.every((r) => r.res.status < 500)).toBe(true);
  });
});
