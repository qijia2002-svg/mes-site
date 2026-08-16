/**
 * 卡片式考试组件：一道题一张卡片，提交后翻转看答案+解析。
 * 支持单选/多选/判断题，完成后显示得分统计。
 */
import { useState, useCallback, useEffect } from 'react';
import { Icon } from './Icon';
import { api, type QuizQuestion } from '../api/endpoints';
import { recordQuiz, type QuizContext } from '../lib/practiceStore';
import './flash-deck.css';

interface QuizDeckProps {
  questions: QuizQuestion[];
  title: string;
  onComplete?: (score: number, total: number) => void;
  /**
   * 统一进度标记（UX 重梳 Phase C 验收 #3）：完成测验时向练习中心写同一份进度。
   * 按入口归类——chapter（章节测验）/ module（模块考试）/ factory（工厂内联自测）/ standalone（随堂测验）。
   * key 用于去重（同一章多次重做只记一次）；不传则按次数累计。
   */
  progress?: { context: QuizContext; key?: string | number };
}

interface QuestionResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
}

export function QuizDeck({ questions, title, onComplete, progress }: QuizDeckProps) {
  const [current, setCurrent] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [graded, setGraded] = useState(false);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // open 题型（自由理解 + AI 判读）
  const [openText, setOpenText] = useState('');
  const [openSubmitting, setOpenSubmitting] = useState(false);
  const [openResult, setOpenResult] = useState<{ score: number; feedback: string; keyPoints: string[] } | null>(null);

  const q = questions[current];
  // 后端理论上恒回数组，但库里出现过双重编码的 options（解出来是字符串），
  // 直接 .map 会整页崩。这里统一收口，脏数据最多让某题无选项，不许白屏。
  const opts: string[] = Array.isArray(q?.options) ? q.options : [];

  const reset = useCallback(() => {
    setSel([]);
    setGraded(false);
    setResult(null);
    setOpenText('');
    setOpenSubmitting(false);
    setOpenResult(null);
  }, []);

  // 切题时重置
  useEffect(() => {
    reset();
  }, [current, reset]);

  const submit = useCallback(async () => {
    if (grading || openSubmitting) return;

    // open 题型：调 AI 判读
    if (q.type === 'open') {
      if (openText.trim().length < 10) return;
      setOpenSubmitting(true);
      try {
        const r = await api.aiGradeQuestion(q.id, openText.trim());
        setOpenResult(r);
        setGraded(true);
        setResults((prev) => {
          const next = [...prev];
          next[current] = r.score >= 60;
          return next;
        });
      } catch {
        setOpenResult({ score: 0, feedback: '提交失败，请重试', keyPoints: [] });
        setGraded(true);
      } finally {
        setOpenSubmitting(false);
      }
      return;
    }

    // 选择/判断题型
    if (sel.length === 0) return;
    setGrading(true);
    try {
      const r = await api.gradeQuestion(q.id, sel.join(','));
      setResult(r);
      setGraded(true);
      setResults((prev) => {
        const next = [...prev];
        next[current] = r.correct;
        return next;
      });
    } catch {
      setResult({ correct: false, correctAnswer: '提交失败', explanation: '网络错误，请重试' });
      setGraded(true);
    } finally {
      setGrading(false);
    }
  }, [q, sel, grading, openText, openSubmitting, current]);

  const next = useCallback(() => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      const score = results.filter(Boolean).length;
      setFinished(true);
      // 统一进度：任何入口的测验完成都写同一份（练习中心据此汇总）。
      recordQuiz({ context: progress?.context ?? 'standalone', key: progress?.key, score, total: questions.length });
      onComplete?.(score, questions.length);
    }
  }, [current, questions.length, results, onComplete]);

  // 答题卡：跳转到指定题目
  const jump = useCallback((i: number) => {
    setCurrent(i);
    setSheetOpen(false);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (finished) return;
      if (!graded && e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        const opt = opts[idx];
        if (!opt) return;
        if (q.type === 'multi') {
          setSel((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
        } else {
          setSel([opt]);
        }
      } else if (graded && e.key === 'Enter') {
        next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [q, graded, finished, next]);

  if (questions.length === 0) {
    return <p className="flash-empty">这一章还没有测试题。</p>;
  }

  if (finished) {
    const score = results.filter(Boolean).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flash-deck">
        <div className="flash-complete flash-complete-stacked">
          <Icon name="success" size={24} />
          <span className="flash-complete-title">{title} 测试完成！</span>
          <span className="flash-complete-score">
            {score} / {questions.length} 正确 · {pct}%
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCurrent(0); setFinished(false); setResults(questions.map(() => null)); }}>
            <Icon name="reset" size={16} />
            重新测试
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round(((current + 1) / questions.length) * 100);
  const typeLabel =
    q.type === 'judge' ? '判断题'
    : q.type === 'multi' ? '多选题'
    : q.type === 'open' ? '理解题'
    : '单选题';

  return (
    <div className="flash-deck">
      {/* 进度条 */}
      <div className="flash-progress-bar">
        <div className="flash-progress-track">
          <div className="flash-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="flash-progress-text">{current + 1} / {questions.length}</span>
      </div>

      {/* 答题卡（下拉导航） */}
      <button type="button" className="quiz-sheet-toggle" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
        <Icon name="dashboard" size={16} />
        <span>答题卡</span>
        <span className="quiz-sheet-count">{questions.length} 题</span>
        <Icon name="chevron-down" size={16} className={`quiz-sheet-chevron${sheetOpen ? ' is-open' : ''}`} />
      </button>
      {sheetOpen && (
        <div className="quiz-sheet">
          {questions.map((_, i) => {
            const st = results[i];
            const cls = [
              'quiz-sheet-cell',
              st === true && 'is-correct',
              st === false && 'is-wrong',
              i === current && 'is-current',
            ].filter(Boolean).join(' ');
            return (
              <button key={i} type="button" className={cls} onClick={() => jump(i)} title={`第 ${i + 1} 题`}>
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* 统计 */}
      <div className="flash-stats">
        <span className="flash-stat flash-stat-mastered">
          <Icon name="success" size={16} />
          正确 {results.filter(Boolean).length}
        </span>
        <span className="flash-stat flash-stat-review">
          <Icon name="warn" size={16} />
          错误 {results.filter((r) => r === false).length}
        </span>
      </div>

      {/* 题目卡片 */}
      <div className="flash-card" key={current}>
        <div className="flash-card-head">
          <span className="flash-card-index">第 {current + 1} 题 · {typeLabel}</span>
        </div>
        <h3 className="flash-card-title">{q.stem}</h3>

        {q.type === 'open' ? (
          <div className="quiz-open">
            <textarea
              className="quiz-open-input"
              placeholder="写下你对这个问题的理解（不少于 10 字）…"
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
              disabled={graded}
              rows={6}
            />
            {graded && openResult && (
              <div className={`quiz-result ${openResult.score >= 60 ? 'is-correct' : 'is-wrong'}`}>
                <div className="quiz-result-head">
                  <Icon name={openResult.score >= 60 ? 'success' : 'error'} size={20} />
                  <span>AI 评分 {openResult.score} 分</span>
                </div>
                {openResult.feedback && (
                  <p className="quiz-result-explanation">{openResult.feedback}</p>
                )}
                {openResult.keyPoints.length > 0 && (
                  <ul className="quiz-result-keypoints">
                    {openResult.keyPoints.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 选项 */}
            <div className="quiz-options">
              {opts.map((opt, i) => {
                const isSelected = sel.includes(opt);
                const isCorrect = graded && result?.correctAnswer.includes(opt);
                const isWrong = graded && isSelected && !result?.correct;
                const cls = `quiz-option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`;
                return (
                  <button
                    key={i}
                    type="button"
                    className={cls}
                    onClick={() => {
                      if (graded) return;
                      if (q.type === 'multi') {
                        setSel((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
                      } else {
                        setSel([opt]);
                      }
                    }}
                    disabled={graded}
                  >
                    <span className="quiz-option-key">{String.fromCharCode(65 + i)}</span>
                    <span className="quiz-option-text">{opt}</span>
                    {isCorrect && <Icon name="success" size={16} className="quiz-option-icon" />}
                    {isWrong && <Icon name="error" size={16} className="quiz-option-icon" />}
                  </button>
                );
              })}
            </div>

            {/* 解析（提交后显示） */}
            {graded && result && (
              <div className={`quiz-result ${result.correct ? 'is-correct' : 'is-wrong'}`}>
                <div className="quiz-result-head">
                  <Icon name={result.correct ? 'success' : 'error'} size={20} />
                  <span>{result.correct ? '回答正确！' : '回答错误'}</span>
                </div>
                {!result.correct && (
                  <p className="quiz-result-answer">
                    正确答案：<strong>{result.correctAnswer}</strong>
                  </p>
                )}
                {result.explanation && (
                  <p className="quiz-result-explanation">{result.explanation}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 操作栏 */}
      <div className="flash-controls">
        {!graded ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={q.type === 'open' ? openText.trim().length < 10 || openSubmitting : sel.length === 0 || grading}
          >
            <Icon name="run" size={16} />
            {q.type === 'open' ? (openSubmitting ? 'AI 评分中…' : '提交理解') : (grading ? '提交中…' : '提交答案')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next}>
            {current < questions.length - 1 ? '下一题' : '查看结果'}
            <Icon name="arrow-right" size={16} />
          </button>
        )}
        <p className="flash-hint">
          {q.type === 'open'
            ? (graded ? 'Enter 继续' : '写下你的理解，AI 会评分')
            : (!graded ? '键盘 1-9 选择选项' : 'Enter 继续')}
        </p>
      </div>
    </div>
  );
}
