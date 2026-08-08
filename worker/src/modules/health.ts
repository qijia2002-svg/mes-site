import type { Ctx } from '../core/context';
import { ok } from '../core/response';

/** Phase 0 验收：一条 /api/v1/health 走完整管道，日志含 traceId 与 d1Stmts。 */
export async function healthHandler(c: Ctx): Promise<Response> {
  return ok(c, {
    status: 'ok',
    degrade: 'L0',
    d1Stmts: c.db.used,
    ts: Date.now(),
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
}

/**
 * GET /api/v1/netinfo — 网络自检页。
 *
 * 「手机流量打不开、WiFi 却能开」这个问题已经复发两次，每次都只能靠猜：
 * 是 DNS 污染？IP 被墙？还是 IPv6 路由黑洞？本机测试给不出答案——开发机的
 * 出口和手机流量根本不是一条路径，本机全 200 不能证明任何事。
 *
 * 所以把判断权交给出问题的那台设备：手机能打开这一页，就能直接看到自己
 * 实际走的是 IPv4 还是 IPv6、落到哪个 Cloudflare 边缘、运营商是谁。
 * 猜测变成读数。
 *
 * 刻意不走 security 中间件：浏览器地址栏直接访问属于导航请求，不带 Origin
 * 头，同源校验会直接拒掉——那样这页永远打不开，也就失去了意义。
 * 这里只读连接元数据，不碰数据库、不返回任何业务数据，放开无风险。
 *
 * 返回 HTML 而非 JSON：出问题时用户是拿手机在看，得一眼能读懂。
 * 样式只用系统默认，不含任何色值（P0-3：禁硬编码 hex）。
 */
export async function netinfoHandler(c: Ctx): Promise<Response> {
  const cf = ((c.req as unknown as { cf?: Record<string, unknown> }).cf ?? {}) as Record<string, unknown>;
  const ip = c.req.headers.get('cf-connecting-ip') ?? '(未知)';
  const isV6 = ip.includes(':');
  const str = (k: string) => (cf[k] == null ? '(未知)' : String(cf[k]));

  const rows: [string, string][] = [
    ['你的 IP', ip],
    ['IP 版本', isV6 ? 'IPv6' : 'IPv4'],
    ['运营商', str('asOrganization')],
    ['接入地区', str('country') + (cf.regionCode ? ' / ' + str('regionCode') : '')],
    ['边缘机房', str('colo')],
    ['HTTP 协议', str('httpProtocol')],
    ['TLS 版本', str('tlsVersion')],
    ['访问域名', c.url.host],
  ];

  // 走 IPv6 是首要嫌疑：大陆移动网络 IPv6 优先，而 Cloudflare 的
  // 2606:4700::/32 在移动网下路由质量很差，表现就是连不上或极慢。
  const verdict = isV6
    ? '你正走 IPv6。若此前打不开站点，这就是首要嫌疑——需在 Cloudflare 关闭该域的 IPv6 Compatibility。'
    : '你正走 IPv4。IPv6 路由问题可以排除，若仍打不开需从别处查。';

  const html = `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>网络自检</title><style>
body{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;margin:0;padding:20px;line-height:1.6;font-size:16px}
h1{font-size:20px;margin:0 0 4px}
p.sub{margin:0 0 20px;font-size:13px;opacity:.65}
table{border-collapse:collapse;width:100%;max-width:560px;font-size:15px}
th,td{text-align:left;padding:9px 8px;border-bottom:1px solid currentColor;vertical-align:top}
th{width:34%;font-weight:600;opacity:.75}
td{word-break:break-all;font-family:ui-monospace,Consolas,monospace}
.verdict{max-width:560px;margin:20px 0;padding:12px 14px;border:2px solid currentColor;border-radius:8px;font-weight:600}
.tip{max-width:560px;font-size:13px;opacity:.75}
</style></head><body>
<h1>网络自检</h1>
<p class="sub">这些是本次请求真实的连接信息，由 Cloudflare 边缘读取</p>
<div class="verdict">${esc(verdict)}</div>
<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
<p class="tip">若某个域名打不开，换其余入口再打开本页对比：能打开的那个走的是什么协议、落在哪个机房，差异就是线索。</p>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
