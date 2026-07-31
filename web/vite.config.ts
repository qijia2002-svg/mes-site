import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 构建产物输出到 worker/public，由 Workers Static Assets 托管。
// base 必须为 '/'，否则嵌套路由（/learn/sql/01）下资源会被解析成 /learn/sql/assets/... 导致 404（规范 §6 修正）。
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../worker/public',
    // 关闭自动清空：本机安全删除拦截器(shim)会把 rm 路由到 trash 而失败，
    // 改为覆盖写入即可。CI/正常环境可改回 true。
    emptyOutDir: false,
  },
});
