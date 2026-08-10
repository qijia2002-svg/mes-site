/**
 * 初学者内联自测（不依赖服务端判分，纯前端即时反馈）。
 * 答完立即显示对错 + 解析，答错也给讲解——目标是"学完检验理解"，不是考试。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { BeginnerQuizQuestion } from './beginnerPath.data';

interface Choice {
  picked: number | null;
  revealed: boolean;
}

export function BeginnerQuiz({ questions, onAllCorrect }: { questions: BeginnerQuizQuestion[]; onAllCorrect?: () => void }) {
  const [choices, setChoices] = useState<Choice[]>(() => questions.map(() => ({ picked: null, revealed: false })));

  const allCorrect = useMemo(
    () => choices.length > 0 && choices.every((c, i) => c.revealed && c.picked !== null && questions[i].answerIndex === c.picked),
    [choices, questions],
  );

  useEffect(() => {
    if (allCorrect) onAllCorrect?.();
  }, [allCorrect, onAllCorrect]);

  const pick = (qi: number, oi: number) => {
    setChoices((prev) => {
      const next = [...prev];
      // 已揭晓则不允许改，避免反复刷"全对"。
      if (next[qi].revealed) return prev;
      next[qi] = { picked: oi, revealed: true };
      return next;
    });
  };

  return (
    <div className="bquiz">
      {questions.map((q, qi) => {
        const c = choices[qi];
        return (
          <div key={qi} className="bquiz-q">
            <p className="bquiz-stem"><span className="bquiz-num">{qi + 1}</span>{q.stem}</p>
            <ul className="bquiz-opts">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answerIndex;
                const isPicked = c.picked === oi;
                const cls = c.revealed
                  ? isAnswer
                    ? ' is-right'
                    : isPicked
                      ? ' is-wrong'
                      : ''
                  : isPicked
                    ? ' is-picked'
                    : '';
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      className={`bquiz-opt${cls}`}
                      disabled={c.revealed}
                      onClick={() => pick(qi, oi)}
                    >
                      <span className="bquiz-opt-mark">
                        {c.revealed ? (isAnswer ? <Icon name="success" size={16} /> : isPicked ? <Icon name="error" size={16} /> : null) : null}
                      </span>
                      <span>{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {c.revealed && (
              <p className={`bquiz-exp${c.picked === q.answerIndex ? ' is-ok' : ' is-bad'}`}>
                <Icon name={c.picked === q.answerIndex ? 'success' : 'hint'} size={16} className="inline-glyph" />
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      {allCorrect && <p className="bquiz-done"><Icon name="check-circle" size={16} /> 全部答对，可以进下一步了。</p>}
    </div>
  );
}
