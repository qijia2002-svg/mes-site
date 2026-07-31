import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 浏览器端 SQL 沙箱（v2 §4 / jshiyan 的 SQLSpace）。
 * 关键决策：SQL 在**浏览器 WASM（sql.js）**内执行，物理隔离、不吃 D1 额度、
 * 可离线、还能练完整 UPDATE/DELETE；判题改为比对结果集，比比对 SQL 文本鲁棒得多。
 *
 * 这与 jshiyan.site 的服务端执行 SQL 相反——服务端执行正是免费版 D1 的安全/额度炸弹，
 * 个人站必须走客户端方案。
 */

// sql.js 通过 CDN 脚本加载（避免打包器 wasm 配置复杂度）
const SQL_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
const SQL_WASM_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm';

interface SqlJsDatabase {
  run(sql: string): void;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
}
interface SqlJsStatic {
  Database: new () => SqlJsDatabase;
}

declare global {
  interface Window {
    initSqlJs?: (cfg: { locateFile: (f: string) => string }) => Promise<SqlJsStatic>;
  }
}

// MES 实训样例库（制造域）：产品 / 设备 / 工单
const SEED_SQL = `
CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT, spec TEXT, unit TEXT);
INSERT INTO products VALUES (1,'减速机','XJ-200','台'),(2,'伺服电机','SM-80','台'),(3,'PLC控制器','FX-3U','个');

CREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, name TEXT, workshop TEXT, status TEXT);
INSERT INTO equipment VALUES (1,'注塑机A','一号车间','运行'),(2,'冲压线B','二号车间','停机'),(3,'焊装机器人C','三号车间','运行');

CREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, product_id INTEGER, qty INTEGER, due_date TEXT, state TEXT);
INSERT INTO work_orders VALUES (1,1,120,'2026-08-10','已下达'),(2,2,60,'2026-08-12','生产中'),(3,1,200,'2026-08-15','已下达');
`;

const SAMPLE_QUERY = `SELECT p.name AS 产品, p.spec AS 规格, SUM(w.qty) AS 计划总量
FROM work_orders w
JOIN products p ON w.product_id = p.product_id
GROUP BY p.product_id
ORDER BY 计划总量 DESC;`;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = new Promise<SqlJsStatic>((resolve, reject) => {
    if (window.initSqlJs) {
      window.initSqlJs({ locateFile: () => SQL_WASM_URL }).then(resolve).catch(reject);
      return;
    }
    const s = document.createElement('script');
    s.src = SQL_JS_URL;
    s.onload = () => {
      if (!window.initSqlJs) return reject(new Error('sql.js 初始化失败'));
      window.initSqlJs({ locateFile: () => SQL_WASM_URL }).then(resolve).catch(reject);
    };
    s.onerror = () => reject(new Error('sql.js 脚本加载失败（检查网络/CDN）'));
    document.body.appendChild(s);
  });
  return sqlJsPromise;
}

export function SqlSandbox() {
  const dbRef = useRef<SqlJsDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sql, setSql] = useState(SAMPLE_QUERY);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [info, setInfo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const seed = useCallback(() => {
    if (!dbRef.current) return;
    try {
      dbRef.current.run(SEED_SQL);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const SQL = await loadSqlJs();
        if (cancelled) return;
        const db = new SQL.Database();
        dbRef.current = db;
        seed();
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seed]);

  const run = useCallback(() => {
    if (!dbRef.current) return;
    setError(null);
    try {
      const results = dbRef.current.exec(sql);
      if (results.length === 0) {
        setColumns([]);
        setRows([]);
        setInfo('执行成功，无结果集（可能是 INSERT / UPDATE / CREATE 等写操作）');
      } else {
        const r = results[results.length - 1];
        setColumns(r.columns);
        setRows(r.values);
        setInfo(`返回 ${r.values.length} 行`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setColumns([]);
      setRows([]);
    }
  }, [sql]);

  const reset = useCallback(() => {
    if (!dbRef.current) return;
    try {
      // 重建库并重新灌入样例数据
      dbRef.current.run('DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS equipment; DROP TABLE IF EXISTS work_orders;');
      seed();
      setColumns([]);
      setRows([]);
      setError(null);
      setInfo('样例数据已重置');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [seed]);

  if (loading) return <div className="sandbox-state">正在加载 SQL 引擎（WASM）…</div>;
  if (loadError)
    return (
      <div className="sandbox-state error">
        沙箱加载失败：{loadError}
        <div className="hint">sql.js 来自 CDN，请确认网络可访问 cdnjs.cloudflare.com。</div>
      </div>
    );

  return (
    <section className="sandbox" aria-label="SQL 在线练习沙箱">
      <header className="sandbox-head">
        <h2>SQL 在线练习沙箱</h2>
        <div className="sandbox-actions">
          <button onClick={run} disabled={!ready} className="btn primary">
            运行 (Ctrl/Cmd+Enter)
          </button>
          <button onClick={reset} className="btn ghost">
            重置样例数据
          </button>
        </div>
      </header>

      <div className="sandbox-tables">
        样例库：<code>products</code> · <code>equipment</code> · <code>work_orders</code>
        <span className="hint">（全部在浏览器本地执行，不上传服务器）</span>
      </div>

      <textarea
        className="sql-editor"
        value={sql}
        spellCheck={false}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            run();
          }
        }}
        aria-label="SQL 编辑器"
      />

      {error && <div className="sandbox-error">⛔ {error}</div>}
      {!error && info && <div className="sandbox-info">{info}</div>}

      {columns.length > 0 && (
        <div className="result-wrap" role="region" aria-label="查询结果">
          <table className="result-table">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell === null ? <em>NULL</em> : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
