import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 构建产物输出到 worker/dist，由 Workers Static Assets 托管。
// 用独立目录规避本机"覆盖写入既有字体文件 EPERM"问题（新建目录只创建不覆盖）。
// base 必须为 '/'，否则嵌套路由（/learn/sql/01）下资源会被解析成 /learn/sql/assets/... 导致 404（规范 §6 修正）。
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../worker/dist',
    // 新目录本就为空，false/true 均可；保持 false 避免本机安全删除拦截器误触发。
    emptyOutDir: false,
  },
});
