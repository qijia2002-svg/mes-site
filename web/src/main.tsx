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
import './styles.css';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
