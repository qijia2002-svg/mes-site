/**
 * sql.js 加载器（ADR-003 / P1-9）。
 * 自托管到 `/vendor/`，与站点同源 —— 平台最大卖点不能挂在境外 CDN 上。
 * 产物由 `web/public/vendor/` 经 vite 复制到 `worker/public/vendor/`，
 * 由 Workers Static Assets 直接托管。
 */

export interface SqlJsQueryResult {
  columns: string[];
  values: unknown[][];
}

export interface SqlJsDatabase {
  run(sql: string): void;
  exec(sql: string): SqlJsQueryResult[];
  close(): void;
}

interface SqlJsStatic {
  Database: new () => SqlJsDatabase;
}

declare global {
  interface Window {
    initSqlJs?: (cfg: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

const SQL_JS_SCRIPT = '/vendor/sql-wasm.js';
const SQL_WASM_FILE = '/vendor/sql-wasm.wasm';

let pending: Promise<SqlJsStatic> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-sqljs="1"]`);
    if (existing) {
      if (window.initSqlJs) return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('sql.js 脚本加载失败')), {
        once: true,
      });
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.sqljs = '1';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`sql.js 脚本加载失败：${src}`));
    document.head.appendChild(el);
  });
}

/** 幂等加载 sql.js 运行时；失败时清空缓存以便重试。 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (pending) return pending;
  pending = (async () => {
    if (!window.initSqlJs) await injectScript(SQL_JS_SCRIPT);
    const init = window.initSqlJs;
    if (!init) throw new Error('sql.js 初始化入口缺失（/vendor/sql-wasm.js 可能未部署）');
    return init({ locateFile: () => SQL_WASM_FILE });
  })().catch((err: unknown) => {
    pending = null;
    throw err;
  });
  return pending;
}

/** 新建一个内存库并灌入数据集。 */
export async function createDatabase(datasetSql: string): Promise<SqlJsDatabase> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  db.run(datasetSql);
  return db;
}
