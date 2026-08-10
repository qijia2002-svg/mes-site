/**
 * 初学者 SQL 练习台（针对零经验者的"四大加强"）。
 *
 * 对应产品 brief 的 问题 → 解法：
 *   1) SQL 太陌生看不懂        → 业务背景横幅 + 逐行注释面板 + 语法提示卡（点关键字就解释）
 *   2) 怕写错、写不出来        → "填入参考解答"先跑通，再对照注释理解
 *   3) 出错就卡住放弃          → 出错时自动解析原因 + 给修改建议
 *   4) 不知道学这个能干嘛      → 每条 SQL 顶部先给"业务背景"
 *
 * 全程复用 sql.js 在浏览器本地跑（useSandboxDb），比对参考解答的结果集哈希判定通过，
 * 不依赖后端判题；答案 SQL 以"参考解答"形式直接可见（初学者模式允许）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { hashResultSet } from '../../lib/resultHash';
import { SANDBOX_TABLES, TABLE_SCHEMAS } from '../sql-sandbox/dataset';
import { useSandboxDb, type QueryOutcome } from '../sql-sandbox/useSandboxDb';
import { ResultTable } from '../sql-sandbox/ResultTable';
import type { BeginnerSqlCase } from './beginnerPath.data';

/** 语法提示卡：点一下就解释这个关键字在干嘛。 */
const SQL_GLOSSARY: Record<string, string> = {
  SELECT: 'SELECT 后面写"要显示哪些列"。想看全部列可写 SELECT *。',
  FROM: 'FROM 指定数据来自哪张表，它是整条查询的"数据源头"。',
  WHERE: 'WHERE 加筛选条件，只保留满足条件的行，如 WHERE state = \'running\'。',
  'JOIN / ON': 'JOIN 把两张表按对应关系拼起来；ON 后面写"用什么字段对应"（通常是外键 = 主键）。',
  'GROUP BY': 'GROUP BY 按某列分组，配合 SUM/COUNT 等得到"每组一行"的汇总。',
  'ORDER BY': 'ORDER BY 排序；默认升序，加 DESC 变降序（从高到低）。',
  'COUNT / SUM / AVG': '聚合函数：COUNT 数行数、SUM 求和、AVG 求平均，须和 GROUP BY 一起用。',
  AS: 'AS 给列或表起别名，只影响显示/简写，如 p.name AS 产品。',
  LIMIT: 'LIMIT n 只取前 n 行，常用于"先看几条样例"。',
  HAVING: 'HAVING 对"分组后的结果"再筛选，区别于 WHERE 筛选原始行。',
  DISTINCT: 'DISTINCT 去重，如 COUNT(DISTINCT 列) 数不重复的值。',
};
const GLOSSARY_ORDER = ['SELECT', 'FROM', 'WHERE', 'JOIN / ON', 'GROUP BY', 'ORDER BY', 'COUNT / SUM / AVG', 'AS', 'LIMIT', 'HAVING', 'DISTINCT'];

/** 把 sql.js 的报错翻成初学者能懂的话 + 修改建议。 */
function explainSqlError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('no such table')) {
    const t = raw.match(/no such table:\s*(\S+)/i)?.[1] ?? '某张表';
    return `找不到表「${t}」。检查 FROM 后面的表名有没有拼错，或点上方"表结构参考"芯片核对真实表名。`;
  }
  if (m.includes('no such column')) {
    const c = raw.match(/no such column:\s*(\S+)/i)?.[1] ?? '某个字段';
    return `找不到列「${c}」。检查 SELECT / WHERE 里用的字段名，和"表结构参考"里的字段对一下。`;
  }
  if (m.includes('ambiguous column')) {
    return '列名有歧义：JOIN 多张表时，同名字段要加表前缀，如 w.state 而不是 state。';
  }
  if (m.includes('misuse of aggregate') || m.includes('aggregate functions are not allowed')) {
    return '聚合函数（SUM/COUNT 等）不能和没分组的普通列并列。补上 GROUP BY 对应列，或把普通列也包进聚合。';
  }
  if (m.includes('syntax error') || m.includes('near')) {
    const near = raw.match(/near "(.+?)":/i)?.[1];
    return near
      ? `语法错误，附近有符号写错（卡在「${near}」附近）。逐行检查引号是否用了英文半角、逗号有没有多/少、关键字有没有拼错。`
      : '语法错误。逐行检查英文半角引号、逗号、关键字拼写。';
  }
  if (m.includes('unrecognized token')) {
    return '有不认识的字符。常见原因：用了中文引号" "或全角符号，改成英文半角再试。';
  }
  if (m.includes('no such function')) {
    return '函数名不存在。检查 SUM/COUNT/ROUND 等是否拼错，或漏了括号。';
  }
  return 'SQL 报错了。对照"逐行注释"里的参考解答，逐行比对关键字拼写和标点，通常差在小地方。';
}

export function BeginnerSqlLab({ sqlCase, onPass }: { sqlCase: BeginnerSqlCase; onPass?: () => void }) {
  // 样例库（与判题库同一份 dataset.sql），无需后端。
  const { status, loadError, run, reset } = useSandboxDb();
  const [sql, setSql] = useState('');
  const [outcome, setOutcome] = useState<QueryOutcome | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [friendly, setFriendly] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [glossary, setGlossary] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  // 参考解答默认折叠：先让学员自己写，点开才给（不拦截，纯参考）。
  const [showRef, setShowRef] = useState(false);
  const expectedHashRef = useRef<string | null>(null);
  const passFired = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // 参考解答的结果集哈希：db 就绪后跑一次，作为"正确"的判据。
  useEffect(() => {
    if (status !== 'ready') return;
    const { outcome: ref } = run(sqlCase.referenceSql);
    if (ref) {
      void hashResultSet(ref.rows).then((h) => {
        expectedHashRef.current = h;
      });
    }
  }, [status, run, sqlCase.referenceSql]);

  const execute = useCallback(() => {
    setRunError(null);
    setFriendly(null);
    setPassed(false);

    const text = sql.trim();
    if (!text) {
      setRunError('先写一条 SQL，或点"填入参考解答"先跑通。');
      setOutcome(null);
      return;
    }

    const { outcome: got, error } = run(text);
    if (error || !got) {
      setOutcome(null);
      setRunError(error ?? '执行失败');
      setFriendly(explainSqlError(error ?? ''));
      return;
    }

    setOutcome(got);

    // 无结果集（写操作）不判题，仅提示。
    if (got.columns.length === 0) {
      setFriendly('这条语句没有返回结果集（可能是 INSERT/UPDATE/CREATE 等写操作）。本题要的是"查询"，换成 SELECT 试试。');
      return;
    }

    void hashResultSet(got.rows).then((h) => {
      if (expectedHashRef.current && h === expectedHashRef.current) {
        setPassed(true);
        if (!passFired.current) {
          passFired.current = true;
          onPass?.();
        }
      } else {
        setFriendly('结果和参考解答不一致：检查列的顺序、行的顺序（ORDER BY）和聚合口径是否和参考解答一致。点"逐行注释"对照一下。');
      }
    });
  }, [sql, run, onPass]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      execute();
    }
  };

  const fillReference = () => {
    setSql(sqlCase.referenceSql);
    setFilled(true);
    setRunError(null);
    setFriendly(null);
    editorRef.current?.focus();
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(sqlCase.referenceSql);
      setFilled(true);
    } catch {
      // 剪贴板不可用时退化为直接填入编辑器
      fillReference();
    }
  };

  const annotationsByLine = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of sqlCase.annotations) map.set(a.line, a.text);
    return map;
  }, [sqlCase.annotations]);

  const refLines = useMemo(() => sqlCase.referenceSql.split('\n'), [sqlCase.referenceSql]);
  const tableChips = SANDBOX_TABLES;

  if (status === 'loading') {
    return (
      <div className="state-block" role="status" aria-live="polite">
        <Icon name="loading" size={20} className="spin" />
        <span>正在加载 SQL 引擎（WebAssembly，仅首次）…</span>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <Icon name="error" size={16} className="alert-glyph" />
        <span>SQL 引擎加载失败：{loadError ?? '未知原因'}</span>
      </div>
    );
  }

  return (
    <div className="bsql">
      {/* 业务背景横幅：先说清楚这条 SQL 在车间里干嘛用 */}
      <div className="bsql-bg">
        <span className="bsql-bg-k"><Icon name="hint" size={16} /> 业务背景</span>
        <p className="bsql-bg-v">{sqlCase.businessBackground}</p>
      </div>

      {/* 任务 */}
      <p className="bsql-prompt"><Icon name="stage" size={16} className="inline-glyph" />{sqlCase.prompt}</p>

      {/* 语法提示卡 */}
      <div className="bsql-gloss">
        <span className="bsql-gloss-t">语法提示卡（点一下就解释）：</span>
        <div className="bsql-gloss-row">
          {GLOSSARY_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className={`pill${glossary === k ? ' pill-ok' : ''}`}
              style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
              onClick={() => setGlossary(glossary === k ? null : k)}
            >
              {k}
            </button>
          ))}
        </div>
        {glossary && (
          <p className="bsql-gloss-card">
            <strong>{glossary}</strong>：{SQL_GLOSSARY[glossary]}
          </p>
        )}
      </div>

      {/* 逐行注释 */}
      <div className="bsql-notes-toggle">
        <button type="button" className="btn btn-xs btn-secondary" onClick={() => setShowNotes((v) => !v)}>
          <Icon name="hint" size={16} />
          {showNotes ? '收起逐行注释' : '看逐行注释'}
        </button>
      </div>
      {showNotes && (
        <div className="bsql-notes">
          {refLines.map((ln, i) => {
            const n = i + 1;
            const note = annotationsByLine.get(n);
            return (
              <div key={n} className="bsql-note-row">
                <pre className="bsql-note-code">{ln || ' '}</pre>
                {note && <p className="bsql-note-text">{note}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* 工具栏 */}
      <div className="sandbox-bar" style={{ marginTop: 'var(--space-3)' }}>
        <div className="sandbox-bar-left">
          <button type="button" className="btn btn-primary" onClick={execute}>
            <Icon name="run" size={16} /> 运行 <kbd className="kbd">Ctrl/⌘ + ↵</kbd>
          </button>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            <Icon name="reset" size={16} /> 重置库
          </button>
        </div>
      </div>

      {/* 参考解答：默认折叠，点开才给（先自己写，不拦截） */}
      <div className="bsql-ref">
        <button
          type="button"
          className="bsql-ref-toggle"
          onClick={() => setShowRef((v) => !v)}
          aria-expanded={showRef}
        >
          <Icon name="answer" size={16} className="inline-glyph" />
          <span>{showRef ? '收起参考解答' : '看参考解答（先跑通，再理解）'}</span>
          <Icon name={showRef ? 'chevron-down' : 'chevron-right'} size={16} className="bsql-ref-c" />
        </button>
        {showRef && (
          <div className="bsql-ref-body">
            <div className="bsql-ref-actions">
              <button type="button" className="btn btn-xs btn-primary" onClick={fillReference}>填入编辑器</button>
              <button type="button" className="btn btn-xs btn-secondary" onClick={() => void copyReference()}>复制</button>
              {filled && !sql && <span className="bsql-ref-hint">已填入，点"运行"看效果</span>}
            </div>
          </div>
        )}
      </div>

      {/* 表结构参考芯片 */}
      <div className="hint-box" style={{ marginTop: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Icon name="table" size={16} className="inline-glyph" />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-2)' }}>表结构参考</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          {tableChips.map((t) => (
            <details key={t} className="bsql-tbl">
              <summary className="pill" style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{t}</summary>
              <table className="data-table" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                <thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>
                <tbody>
                  {(TABLE_SCHEMAS[t]?.fields ?? []).map((f) => (
                    <tr key={f.name}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{f.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{f.type}</td>
                      <td style={{ color: 'var(--muted)' }}>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      </div>

      <label className="editor-label" htmlFor="bsql-editor" style={{ marginTop: 'var(--space-3)' }}>SQL 编辑器</label>
      <textarea
        id="bsql-editor"
        ref={editorRef}
        className="sql-editor"
        value={sql}
        spellCheck={false}
        placeholder="在此写 SQL，例如：SELECT * FROM work_orders;"
        onChange={(e) => { setSql(e.target.value); setFilled(false); }}
        onKeyDown={onKeyDown}
      />

      {runError && (
        <p className="alert alert-danger" role="alert">
          <Icon name="error" size={16} className="alert-glyph" />
          <span>{runError}</span>
        </p>
      )}

      {passed ? (
        <div className="alert alert-ok" role="status">
          <Icon name="success" size={16} className="alert-glyph" />
          <div>
            <strong>跑通了，结果和预期一致</strong>
            <span className="alert-sub">很好——现在试着不依赖参考解答，自己写一遍，巩固一下。</span>
          </div>
        </div>
      ) : friendly && !runError ? (
        <p className="alert alert-info" role="alert">
          <Icon name="info" size={16} className="alert-glyph" />
          <span>{friendly}</span>
        </p>
      ) : null}

      {outcome && <ResultTable columns={outcome.columns} rows={outcome.rows} />}
    </div>
  );
}
