/**
 * SQL 工作台（F3 判题闭环 / AC-03 / AC-04）。
 *
 * 判题全在客户端：sql.js 跑用户 SQL → 结果集归一化 → SHA-256 → 与题目下发的
 * answer_hash 比对。答案 SQL 永不出网（Spec §10）。提交只上报 passed + client_hash
 * 供服务端审计，判定以客户端为准。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/StateBlock';
import { hashResultSet } from '../../lib/resultHash';
import { api, readAnswerHash, readSchemaHint, type SqlExercise } from '../../api/endpoints';
import { SANDBOX_SAMPLE_QUERY, SANDBOX_TABLES, TABLE_SCHEMAS, SANDBOX_CHALLENGES, type SandboxChallenge } from './dataset';
import { useSandboxDb, type QueryOutcome } from './useSandboxDb';
import { ResultTable } from './ResultTable';

type Verdict =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'passed' }
  | { kind: 'failed'; reason: string }
  | { kind: 'unavailable'; reason: string };

export function SqlSandbox({ exercise }: { exercise?: SqlExercise }) {
  const { status, loadError, run, reset } = useSandboxDb();
  const [sql, setSql] = useState(SANDBOX_SAMPLE_QUERY);
  const [outcome, setOutcome] = useState<QueryOutcome | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });
  const [submitNote, setSubmitNote] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const answerHash = exercise ? readAnswerHash(exercise) : '';
  const schemaHint = exercise ? readSchemaHint(exercise) : '';
  const exerciseId = exercise?.id;

  // 切题目：清空上一题的残留状态，否则会把上一题的"通过"带到新题上。
  useEffect(() => {
    setSql(exerciseId ? '' : SANDBOX_SAMPLE_QUERY);
    setOutcome(null);
    setRunError(null);
    setVerdict({ kind: 'idle' });
    setSubmitNote(null);
  }, [exerciseId]);

  const reportProgress = useCallback(
    async (id: number, passed: boolean, clientHash: string) => {
      // 判题结果已经呈现给用户了，上报失败不能反过来把 UI 打回失败态。
      try {
        await api.submitSql(id, { passed, client_hash: clientHash });
        if (passed) {
          await api.recordProgress({
            item_type: 'sql_exercise',
            item_id: String(id),
            status: 'passed',
          });
        }
        setSubmitNote(null);
      } catch {
        setSubmitNote('成绩已在本地判定，但同步到服务器失败，稍后重试或检查网络。');
      }
    },
    [],
  );

  const execute = useCallback(async () => {
    setRunError(null);
    setSubmitNote(null);
    const { outcome: got, error } = run(sql);

    if (error || !got) {
      setOutcome(null);
      setRunError(error ?? '执行失败');
      setVerdict(exerciseId ? { kind: 'failed', reason: 'SQL 执行报错，先修好语法再判题。' } : { kind: 'idle' });
      return;
    }

    setOutcome(got);

    if (!exerciseId || !answerHash) {
      setVerdict({ kind: 'idle' });
      return;
    }

    setVerdict({ kind: 'checking' });
    try {
      const clientHash = await hashResultSet(got.rows);
      const passed = clientHash === answerHash;
      setVerdict(
        passed
          ? { kind: 'passed' }
          : {
              kind: 'failed',
              reason:
                got.columns.length === 0
                  ? '这条语句没有返回结果集，题目要求返回查询结果。'
                  : '结果集与期望不一致：检查列的顺序、行的顺序（ORDER BY）和聚合口径。',
            },
      );
      void reportProgress(exerciseId, passed, clientHash);
    } catch (e) {
      setVerdict({ kind: 'unavailable', reason: e instanceof Error ? e.message : String(e) });
    }
  }, [run, sql, exerciseId, answerHash, reportProgress]);

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void execute();
    }
  };

  const tableList = useMemo(() => SANDBOX_TABLES.join(' · '), []);

  if (status === 'loading') {
    return (
      <div className="state-block" role="status" aria-live="polite">
        <Icon name="loading" size={20} className="spin" />
        <span>正在加载 SQL 引擎（WebAssembly，约 640 KB，仅首次）…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="SQL 引擎加载失败"
        error={new Error(loadError ?? '未知原因')}
        onRetry={reset}
      />
    );
  }

  const TABS = ['全部', '基础查询', '关联查询', '聚合统计', '综合实战'];
  const DIFFICULTIES = ['全部', '入门', '进阶', '高级'];

  // 用分类 / 难度把引导挑战真正筛出来（之前这两个按钮是死的，点了不筛选）。
  const filteredChallenges = SANDBOX_CHALLENGES.filter(
    (c) => (activeTab === '全部' || c.category === activeTab) && (difficulty === '全部' || c.difficulty === difficulty),
  );

  const loadChallenge = (c: SandboxChallenge) => {
    setSql(c.starterSql);
    setOutcome(null);
    setRunError(null);
  };

  return (
    <section className="sandbox" aria-label="SQL 工作台">
      {/* Pill 分类标签 */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        {TABS.map(t => (
          <button key={t} type="button"
            className="btn btn-sm"
            style={{
              background: activeTab === t ? 'var(--accent)' : 'var(--surface-2)',
              color: activeTab === t ? '#fff' : 'var(--muted)',
              border: '1px solid ' + (activeTab === t ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 'var(--radius-pill)',
            }}
            onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* 难度筛选 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--meta)', marginBottom: 'var(--space-3)' }}>
        <span>难度：</span>
        {DIFFICULTIES.map(d => (
          <button key={d} type="button"
            className="btn btn-xs"
            style={{
              background: difficulty === d ? 'var(--accent)' : 'var(--surface-2)',
              color: difficulty === d ? '#fff' : 'var(--muted)',
              border: '1px solid ' + (difficulty === d ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 'var(--radius-pill)',
            }}
            onClick={() => setDifficulty(d)}>
            {d}
          </button>
        ))}
      </div>

      {!exerciseId && SANDBOX_CHALLENGES.length > 0 && (
        <div className="sandbox-challenges">
          <div className="sandbox-challenges-head">
            <Icon name="quiz" size={16} className="inline-glyph" />
            <span>挑一个场景练手</span>
            <span className="row-meta">共 {filteredChallenges.length} 个</span>
          </div>
          <ul className="challenge-list">
            {filteredChallenges.map((c) => (
              <li key={c.id} className={`challenge-item${expanded === c.id ? ' is-open' : ''}`}>
                <div className="challenge-top">
                  <div className="challenge-meta">
                    <span className="challenge-title">{c.title}</span>
                    <span className={`tag tag-${c.difficulty === '入门' ? 'ok' : c.difficulty === '进阶' ? 'warn' : 'hot'}`}>{c.difficulty}</span>
                  </div>
                  <div className="challenge-actions">
                    <button type="button" className="btn btn-xs btn-primary" onClick={() => loadChallenge(c)}>载入模板</button>
                    <button type="button" className="btn btn-xs btn-secondary" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>{expanded === c.id ? '收起' : '看预期'}</button>
                  </div>
                </div>
                <p className="challenge-scenario">{c.scenario}</p>
                {expanded === c.id && (
                  <p className="challenge-expected"><Icon name="hint" size={16} className="inline-glyph" />{c.expected}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sandbox-bar">
        <div className="sandbox-bar-left">
          <button type="button" className="btn btn-primary" onClick={() => void execute()}>
            <Icon name="run" size={16} />
            运行
            <kbd className="kbd">Ctrl/⌘ + ↵</kbd>
          </button>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            <Icon name="reset" size={16} />
            重置样例库
          </button>
        </div>
        <p className="sandbox-scope">
          <Icon name="table" size={16} className="inline-glyph" />
          {tableList}
          <span className="sandbox-scope-note">全部在浏览器本地执行，不上传服务器</span>
        </p>
      </div>

      {schemaHint && (
        <details className="hint-box">
          <summary>
            <Icon name="hint" size={16} className="inline-glyph" />
            表结构提示
          </summary>
          <pre className="hint-pre">{schemaHint}</pre>
        </details>
      )}

      {/* 表结构参考芯片 */}
      <div className="hint-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: activeTable ? 'var(--space-3)' : 0 }}>
          <Icon name="table" size={16} className="inline-glyph" />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-2)' }}>表结构参考</span>
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            {SANDBOX_TABLES.map((t) => (
              <button
                key={t}
                type="button"
                className={`pill${activeTable === t ? ' pill-ok' : ''}`}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
                onClick={() => setActiveTable(activeTable === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {activeTable && TABLE_SCHEMAS[activeTable] && (
          <div style={{ padding: 'var(--space-2) 0 0', borderTop: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-announce-cjk)', color: 'var(--fg)', marginBottom: 'var(--space-2)' }}>
              {TABLE_SCHEMAS[activeTable].name}（{activeTable}）
            </div>
            <table className="data-table" style={{ fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr>
                  <th>字段名</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_SCHEMAS[activeTable].fields.map((f) => (
                  <tr key={f.name}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{f.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{f.type}</td>
                    <td style={{ color: 'var(--muted)' }}>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="editor-label" htmlFor="sql-editor">
        SQL 编辑器
      </label>
      <textarea
        id="sql-editor"
        ref={editorRef}
        className="sql-editor"
        value={sql}
        spellCheck={false}
        placeholder="在此写 SQL，例如：SELECT * FROM work_orders;"
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onEditorKeyDown}
      />

      {runError && (
        <p className="alert alert-danger" role="alert">
          <Icon name="error" size={16} className="alert-glyph" />
          <span>{runError}</span>
        </p>
      )}

      {!runError && outcome && (
        <p className="alert alert-info">
          <Icon name="info" size={16} className="alert-glyph" />
          <span>{outcome.notice}</span>
        </p>
      )}

      {exerciseId != null && <VerdictBanner verdict={verdict} note={submitNote} />}

      {outcome && <ResultTable columns={outcome.columns} rows={outcome.rows} />}
    </section>
  );
}

function VerdictBanner({ verdict, note }: { verdict: Verdict; note: string | null }) {
  if (verdict.kind === 'idle') return null;

  if (verdict.kind === 'checking') {
    return (
      <p className="alert alert-info" role="status">
        <Icon name="loading" size={16} className="alert-glyph spin" />
        <span>正在比对结果集…</span>
      </p>
    );
  }

  if (verdict.kind === 'passed') {
    return (
      <div className="alert alert-ok" role="status">
        <Icon name="success" size={16} className="alert-glyph" />
        <div>
          <strong>判定通过</strong>
          <span className="alert-sub">结果集与标准答案一致，进度已记录。</span>
          {note && <span className="alert-sub">{note}</span>}
        </div>
      </div>
    );
  }

  if (verdict.kind === 'unavailable') {
    return (
      <div className="alert alert-warn" role="alert">
        <Icon name="warn" size={16} className="alert-glyph" />
        <div>
          <strong>判题暂不可用</strong>
          <span className="alert-sub">{verdict.reason}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="alert alert-danger" role="alert">
      <Icon name="error" size={16} className="alert-glyph" />
      <div>
        <strong>还没通过</strong>
        <span className="alert-sub">{verdict.reason}</span>
        {note && <span className="alert-sub">{note}</span>}
      </div>
    </div>
  );
}
