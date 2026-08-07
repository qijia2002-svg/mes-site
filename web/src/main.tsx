import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 字体自托管（禁 Google Fonts CDN：国内首屏不可控）。
// 三套字体统一走 variable 包（ADR-004）：静态 Noto Sans SC 会往产物里塞
// 1905 个 woff2（3 档字重 × 635 分片），逼近 Cloudflare Pages 2 万文件上限；
// variable 版一档覆盖 100-900，只剩 101 个 unicode-range 分片，按需下载。
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/noto-sans-sc';

import App from './App';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const qc = new QueryClient({
  // staleTime 30s：从课程/章节页返回首页时优先命中缓存，不再立即重取导致整页"重新加载"闪烁。
  // refetchOnWindowFocus 关掉：避免切窗口/切回时静默重刷触发偶发报错。
  // networkMode:'always'：手机弱网/短暂掉线不再卡在"加载中"（React Query v5 默认 online 会阻塞请求）。
  // retry:2 + 指数退避 + refetchOnReconnect：覆盖移动端瞬时抖动，重连后自动补刷。
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
      networkMode: 'always',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
