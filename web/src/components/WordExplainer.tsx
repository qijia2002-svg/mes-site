/**
 * 名称翻译 / 英文单词解释卡片（带发音）。
 *
 * 能力：输入框 + 分组专业词汇表（点选即查）+ 结果卡，展示
 *   词性 / 中文翻译 / 英文例句（可朗读 en-US）/ 中文译文 / 分类标签 / 一句话详解。
 * 数据来自后端 POST /api/v1/ai/explain-word（离线词典兜底 + Workers AI 生成）。
 *
 * 遵循 P0：图标走 Icon 体系、颜色用 design token（禁硬编码 hex）、零 emoji、
 * 单文件 ≤300 行、所有 hook 置于组件顶部（防 React #310 多 hook 顺序错乱）。
 *
 * 移动端适配：搜索框 sticky 顶部常驻；结果卡紧跟搜索框（搜完即见，不被词库推到二屏）；
 * 行业词库默认折叠，避免手机端首屏被上百个 chip 占满。
 */
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icon } from './Icon';
import { api, type ExplainWordResult } from '../api/endpoints';
import { useDict, groupByType } from '../lib/dict';
import { WordSpeaker } from './WordSpeaker';
import { VoiceButton } from './VoiceButton';

// 词表来自云端词典（useDict 缓存），按类型分组渲染，不再硬编码。

export default function WordExplainer({ initialWord }: { initialWord?: string }) {
  const [word, setWord] = useState(initialWord ?? '');
  const [result, setResult] = useState<ExplainWordResult | null>(null);
  // 行业词库默认收起：手机端首屏不被上百 chip 占满，搜索结果卡才能紧跟搜索框首屏可见。
  const [showDict, setShowDict] = useState(false);
  const dictQ = useDict();
  const groups = groupByType(dictQ.data);

  const mutation = useMutation({
    mutationFn: (w: string) => api.explainWord({ word: w }),
    onSuccess: (data) => setResult(data),
  });

  const submit = (w: string) => {
    const clean = w.trim();
    if (!clean) return;
    setWord(clean);
    mutation.mutate(clean);
  };

  // 深链：从首页等入口带 ?q= 直达时，自动查询该词
  useEffect(() => {
    if (initialWord && initialWord.trim()) submit(initialWord.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(word);
  };

  return (
    <div className="word-explainer">
      <form
        className="we-form"
        onSubmit={onFormSubmit}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--surface)',
          padding: 'var(--space-2) 0',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--meta)', display: 'inline-flex' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="we-input"
            type="text"
            value={word}
            placeholder="输入英文单词，如 SELECT"
            onChange={(e) => setWord(e.target.value)}
            aria-label="英文单词"
            style={{
              width: '100%', padding: 'var(--space-2) var(--space-3)', paddingLeft: 'calc(var(--space-6) + 4px)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)',
              background: 'var(--surface)', color: 'var(--fg)', fontSize: 'var(--text-base)',
            }}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending || !word.trim()}>
          <Icon name="run" size={16} /> 解释
        </button>
      </form>

      {mutation.isPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)', color: 'var(--meta)' }}>
          <Icon name="loading" size={16} className="spin" /> 正在查询…
        </div>
      )}
      {mutation.isError && (
        <p style={{ color: 'var(--danger)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>查询失败，请稍后再试。</p>
      )}

      {/* 结果卡：紧跟搜索框，提交后首屏立即可见（不再被词库 chips 推到二屏）。 */}
      {result && !mutation.isPending && (
        <div className="card" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-announce-cjk)', fontFamily: 'var(--font-mono)' }}>{result.word}</span>
            <WordSpeaker word={result.word} />
            {result.pos && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', fontFamily: 'var(--font-mono)' }}>{result.pos}</span>
            )}
            <span
              className="tag"
              style={{ marginLeft: 'auto', background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}
            >
              {result.category}
            </span>
          </div>

          {result.zh && (
            <p style={{ fontSize: 'var(--text-lg)', marginTop: 'var(--space-3)', color: 'var(--fg)' }}>{result.zh}</p>
          )}

          {result.example && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--fg)' }}>{result.example}</code>
                <VoiceButton text={result.example} lang="en-US" />
              </div>
              {result.exampleZh && (
                <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--meta)' }}>{result.exampleZh}</div>
              )}
            </div>
          )}

          {result.detail && (
            <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--meta)', lineHeight: 1.7 }}>{result.detail}</p>
          )}
        </div>
      )}

      {/* 行业词库：默认收起，点击展开（来自云端词典，按类型分组）。手机端首屏不被占满。 */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={() => setShowDict((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-soft)',
            background: 'var(--surface-2)',
            color: 'var(--fg)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          <span>行业词库（{groups.reduce((n, g) => n + g.items.length, 0)} 词）</span>
          <span style={{ color: 'var(--meta)' }}>{showDict ? '收起' : '展开'}</span>
        </button>
        {showDict && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {dictQ.isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--meta)' }}>
                <Icon name="loading" size={16} className="spin" /> 加载词库中…
              </div>
            )}
            {groups.map((grp) => (
              <div key={grp.type.typeKey}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', marginBottom: 'var(--space-2)' }}>{grp.type.name}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {grp.items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className="we-chip"
                      onClick={() => submit(it.value)}
                      disabled={mutation.isPending}
                      style={{
                        padding: '4px var(--space-3)', borderRadius: 999, cursor: 'pointer',
                        border: '1px solid var(--border-soft)', background: 'var(--surface)',
                        color: 'var(--accent)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {it.value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
