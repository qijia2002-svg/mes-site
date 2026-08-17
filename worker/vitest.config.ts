import { defineConfig } from 'vitest/config';

// 测试运行时：Vitest（node 环境） + 由 globalSetup 拉起真实的 `wrangler dev`（本地 D1+DO），
// 测试通过真实 HTTP 打接口。这复用项目既有的本地运行时，无需额外的 pool 包。
export default defineConfig({
  test: {
    // globalSetup 负责启动 wrangler dev + 播种本地 D1；globalTeardown 负责关闭
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // 阶段 0 宽松：阶段 3 再收紧到具体阈值（如 lines >= 70）
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
});
