/**
 * 沙箱数据库生命周期：加载 sql.js（同源 /vendor/）→ 建库灌数据 → 执行 / 重置。
 * SQL 全程在浏览器 WASM 内跑：物理隔离、不吃 D1 额度、可离线、能练完整写操作。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDatabase, type SqlJsDatabase } from '../../lib/sqljs';
import { SANDBOX_DATASET_SQL } from './dataset';

export interface QueryOutcome {
  columns: string[];
  rows: unknown[][];
  /** 无结果集的写操作也算成功，用这句话告诉用户发生了什么 */
  notice: string;
}

type Status = 'loading' | 'ready' | 'error';

export function useSandboxDb() {
  const dbRef = useRef<SqlJsDatabase | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    createDatabase(SANDBOX_DATASET_SQL)
      .then((db) => {
        if (cancelled) {
          db.close();
          return;
        }
        dbRef.current = db;
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      const db = dbRef.current;
      dbRef.current = null;
      // StrictMode 双挂载会建两个库，不关会泄漏一整份 WASM 堆。
      if (db) {
        try {
          db.close();
        } catch {
          /* 关库失败无补救动作，忽略 */
        }
      }
    };
  }, [reloadKey]);

  /** 执行 SQL。返回 outcome 或 error 文本，绝不抛给调用方。 */
  const run = useCallback((sql: string): { outcome?: QueryOutcome; error?: string } => {
    const db = dbRef.current;
    if (!db) return { error: '沙箱尚未就绪' };
    const text = sql.trim();
    if (!text) return { error: '请先写一条 SQL 再运行' };

    try {
      const results = db.exec(text);
      if (results.length === 0) {
        return {
          outcome: {
            columns: [],
            rows: [],
            notice: '执行成功，无结果集（INSERT / UPDATE / DELETE / CREATE 等写操作）',
          },
        };
      }
      // 多语句时以最后一个结果集为准，与判题口径一致。
      const last = results[results.length - 1];
      return {
        outcome: {
          columns: last.columns,
          rows: last.values,
          notice: `返回 ${last.values.length} 行 × ${last.columns.length} 列`,
        },
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  /** 重置：整库重建，比逐表 DROP 稳（用户可能已经建了新表）。 */
  const reset = useCallback(() => setReloadKey((k) => k + 1), []);

  return { status, loadError, run, reset };
}
