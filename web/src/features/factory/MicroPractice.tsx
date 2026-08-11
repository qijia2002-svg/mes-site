/**
 * 微练习（SQL 前台阶，计入完成度）——抽屉实战区内联展开，不跳页。
 *
 * 三种交互全部**键盘可达**，刻意不用拖拽：
 *   match 左右配对 → 每个左项一个 <select> 选右项
 *   order 排顺序   → 每项上/下移按钮
 *   pick  选一个/多个 → radio / checkbox
 * 拖拽对零基础 + 移动端 + 读屏都是负担，这里的目标是「答得出来」，不是炫交互。
 *
 * 判分**只在服务端**：answer 留在 micro_practices 表里，前端只提交作答、只收
 * correct + feedback，绝不在前端比对答案（答案出网 = 判题基准失效）。
 *
 * 反馈三重编码（图标 + 文字 + 底色），不靠颜色单独传意；错了给具体错因，
 * 永不只回「答案错误」。
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../components/Icon';
import { ApiError } from '../../api/client';
import { api, type MicroAnswer, type MicroItem } from '../../api/endpoints';
import { renderChapterMarkdown } from '../../lib/markdown';

export interface MicroPracticeProps {
  id: number;
  title: string;
  done: boolean;
  /** 判分通过时回调，由调用方派发 factory:resource-done 落进度。 */
  onSolved: () => void;
}

interface Verdict {
  correct: boolean;
  feedback: string;
}

export default function MicroPractice({ id, title, done, onSolved }: MicroPracticeProps) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 分级提示（ADR-019：只答错后按需拉取，绝不随题面预拉，不剧透答案）。
  // hints[0] = 第 1 级 bodyMd，依次类推；hasNext 决定是否给「下一级」按钮。
  const [hints, setHints] = useState<string[]>([]);
  const [hintHasNext, setHintHasNext] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintErr, setHintErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['micro-practice', id],
    queryFn: ({ signal }) => {
      // D1 Free 偶发查询挂起不返回，8s 超时快速失败，显示错误提示而非永远"加载中"。
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      signal?.addEventListener('abort', () => ctrl.abort());
      return api.microPractice(id, ctrl.signal).finally(() => clearTimeout(t));
    },
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const data = q.data;
  const payload = data?.payload ?? {};
  const items: MicroItem[] = payload.items ?? [];
  const options: MicroItem[] = payload.options ?? [];
  const left: MicroItem[] = payload.left ?? [];
  const right: MicroItem[] = payload.right ?? [];
  const ids = orderIds ?? items.map((i) => i.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrderIds(next);
  };

  // 没答完就别让他提交——空提交拿回一个「错」是纯粹的挫败，不是反馈。
  const answer = (): MicroAnswer | null => {
    if (!data) return null;
    if (data.kind === 'match') {
      return left.length > 0 && left.every((l) => pairs[l.id]) ? pairs : null;
    }
    if (data.kind === 'order') return ids.length > 0 ? ids : null;
    return picked.length > 0 ? picked : null;
  };

  const ready = answer() !== null;

  const submit = async () => {
    const body = answer();
    if (!body || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api.gradeMicroPractice(id, body);
      setVerdict({ correct: !!res.correct, feedback: res.feedback ?? '' });
      if (res.correct) onSolved();
    } catch (e) {
      // 判分服务没上线 / 网络断了：说清楚是「判不了」而不是「你错了」。
      const msg = e instanceof ApiError && !e.isNetwork
        ? `判分服务暂时不可用（${e.code}），这题先跳过，不影响你继续往下走。`
        : '网络没连上，判分没发出去。检查网络后再试一次。';
      setFailure(msg);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setVerdict(null);
    setFailure(null);
    setHints([]);
    setHintHasNext(false);
    setHintErr(null);
  };

  /** 答错后才按需拉某一級提示（1→2→3），绝不预拉。 */
  const loadHint = async (level: 1 | 2 | 3) => {
    if (level < 1 || level > 3) return;
    setHintBusy(true);
    setHintErr(null);
    try {
      const dto = await api.practiceHint('micro', id, level);
      setHints((prev) => {
        const next = [...prev];
        next[level - 1] = dto.bodyMd;
        return next;
      });
      setHintHasNext(!!dto.hasNext);
    } catch {
      setHintErr('提示暂时取不出来，先按上面的反馈再试一次。');
    } finally {
      setHintBusy(false);
    }
  };

  // 第一次答错才自动拉第 1 级；之后靠「下一级」按钮递进，不再自动连拉。
  useEffect(() => {
    if (verdict && !verdict.correct && hints.length === 0 && !hintErr) {
      void loadHint(1);
    }
  }, [verdict, hints.length, hintErr]);

  return (
    <div className={`mp${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="mp-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mp-ti"><Icon name="quiz" size={20} /></span>
        <span className="mp-tt">
          <span className="mp-tl">{title}</span>
          <span className="mp-tk">动手练 · 一分钟</span>
        </span>
        <span className="mp-tg">
          {done
            ? <Icon name="check-circle" size={16} label="已完成" />
            : <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} />}
        </span>
      </button>

      {open && (
        <div className="mp-body">
          {q.isLoading && <p className="mp-note">题目加载中…</p>}

          {q.isError && (
            <p className="mp-note">
              这道练习暂时取不出来（内容还在播种中）。先做旁边的测验，回头再来。
            </p>
          )}

          {data && (
            <>
              <p className="mp-prompt">{data.prompt}</p>

              {data.kind === 'match' && (
                <ul className="mp-list">
                  {left.map((l) => (
                    <li key={l.id} className="mp-pair">
                      <span className="mp-pl">{l.text}</span>
                      <span className="mp-px"><Icon name="mapping" size={16} /></span>
                      <select
                        className="mp-sel"
                        aria-label={`为「${l.text}」选择对应项`}
                        value={pairs[l.id] ?? ''}
                        onChange={(e) => setPairs((p) => ({ ...p, [l.id]: e.target.value }))}
                      >
                        <option value="">请选择…</option>
                        {right.map((r) => (
                          <option key={r.id} value={r.id}>{r.text}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}

              {data.kind === 'order' && (
                <ol className="mp-list">
                  {ids.map((oid, idx) => {
                    const it = items.find((x) => x.id === oid);
                    return (
                      <li key={oid} className="mp-ord">
                        <span className="mp-on tabular">{idx + 1}</span>
                        <span className="mp-ot">{it?.text ?? oid}</span>
                        <span className="mp-oa">
                          <button
                            type="button" onClick={() => move(idx, idx - 1)}
                            disabled={idx === 0} aria-label={`把「${it?.text ?? oid}」上移`}
                          >
                            <Icon name="chevron-up" size={16} />
                          </button>
                          <button
                            type="button" onClick={() => move(idx, idx + 1)}
                            disabled={idx === ids.length - 1}
                            aria-label={`把「${it?.text ?? oid}」下移`}
                          >
                            <Icon name="chevron-down" size={16} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {data.kind === 'pick' && (
                <ul className="mp-list">
                  {options.map((o) => {
                    const multi = payload.multi === true;
                    const on = picked.includes(o.id);
                    return (
                      <li key={o.id}>
                        <label className={`mp-opt${on ? ' is-on' : ''}`}>
                          <input
                            type={multi ? 'checkbox' : 'radio'}
                            name={`mp-${id}`}
                            value={o.id}
                            checked={on}
                            onChange={() =>
                              setPicked((cur) =>
                                multi
                                  ? cur.includes(o.id)
                                    ? cur.filter((x) => x !== o.id)
                                    : [...cur, o.id]
                                  : [o.id],
                              )
                            }
                          />
                          <span>{o.text}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {verdict && (
                <div className={`mp-fb ${verdict.correct ? 'is-ok' : 'is-bad'}`} role="status">
                  <Icon name={verdict.correct ? 'success' : 'error'} size={16} />
                  <span>
                    <strong>{verdict.correct ? '对了' : '再看一眼'}</strong>
                    {verdict.feedback ? ` — ${verdict.feedback}` : ''}
                  </span>
                </div>
              )}

              {failure && (
                <div className="mp-fb is-bad" role="status">
                  <Icon name="warn" size={16} />
                  <span>{failure}</span>
                </div>
              )}

              {hints.length > 0 && (
                <div className="mp-hint" role="status" aria-live="polite">
                  <div className="mp-hint-h">
                    <Icon name="hint" size={16} />
                    <span className="caps">提示（只给思路，不剧透答案）</span>
                  </div>
                  {hints.map((h, i) => {
                    const { html } = renderChapterMarkdown(h);
                    return (
                      <div key={i} className="mp-hint-body prose" dangerouslySetInnerHTML={{ __html: html }} />
                    );
                  })}
                  {hintHasNext && hints.length < 3 && (
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => loadHint((hints.length + 1) as 1 | 2 | 3)}
                      disabled={hintBusy}
                    >
                      {hintBusy ? '加载中…' : `看第 ${hints.length + 1} 级提示`}
                    </button>
                  )}
                  {hintErr && <p className="mp-hint-err">{hintErr}</p>}
                </div>
              )}

              <div className="mp-act">
                {verdict?.correct ? (
                  <span className="mp-passed"><Icon name="success" size={16} />这题过了</span>
                ) : (
                  <button
                    type="button" className="btn btn-primary"
                    onClick={submit} disabled={!ready || busy}
                  >
                    {busy ? '判分中…' : '提交'}
                  </button>
                )}
                {(verdict || failure) && !verdict?.correct && (
                  <button type="button" className="btn btn-secondary" onClick={retry}>
                    <Icon name="reset" size={16} />
                    再试一次
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
