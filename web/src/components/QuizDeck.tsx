/**
 * 卡片式考试组件：一道题一张卡片，提交后翻转看答案+解析。
 * 支持单选/多选/判断题，完成后显示得分统计。
 */
import { useState, useCallback, useEffect } from 'react';
import { Icon } from './Icon';
import { api, type QuizQuestion } from '../api/endpoints';
import './FlashCardDeck.css';

interface QuizDeckProps {
  questions: QuizQuestion[];
  title: string;
  onComplete?: (score: number, total: number) => void;
}

interface QuestionResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
}

export function QuizDeck({ questions, title, onComplete }: QuizDeckProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [graded, setGraded] = useState(false);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const q = questions[current];

  const reset = useCallback(() => {
    setSelected('');
    setGraded(false);
    setResult(null);
  }, []);

  // 切题时重置
  useEffect(() => {
    reset();
  }, [current, reset]);

  const submit = useCallback(async () => {
    if (!selected || grading) return;
    setGrading(true);
    try {
      const r = await api.gradeQuestion(q.id, selected);
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
  }, [selected, grading, q.id, current]);

  const next = useCallback(() => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      const score = results.filter(Boolean).length;
      setFinished(true);
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
        if (q.options[idx]) setSelected(q.options[idx]);
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
  const typeLabel = q.type === 'judge' ? '判断题' : q.type === 'multi' ? '多选题' : '单选题';

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

        {/* 选项 */}
        <div className="quiz-options">
          {q.options.map((opt, i) => {
            const isSelected = selected === opt;
            const isCorrect = graded && result?.correctAnswer.includes(opt);
            const isWrong = graded && isSelected && !result?.correct;
            const cls = `quiz-option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`;
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => !graded && setSelected(opt)}
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
      </div>

      {/* 操作栏 */}
      <div className="flash-controls">
        {!graded ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={!selected || grading}
          >
            <Icon name="run" size={16} />
            {grading ? '提交中…' : '提交答案'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next}>
            {current < questions.length - 1 ? '下一题' : '查看结果'}
            <Icon name="arrow-right" size={16} />
          </button>
        )}
        <p className="flash-hint">
          {!graded ? '键盘 1-9 选择选项' : 'Enter 继续'}
        </p>
      </div>
    </div>
  );
}
