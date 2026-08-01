/**
 * 五态收口：Loading / Empty / Error。
 * 错误态必须展示可复制的 traceId —— 用户报障时这是唯一能定位到那一次请求的东西。
 */
import { useState } from 'react';
import { Icon, SpinnerIcon, type IconName } from './Icon';
import { ApiError, toApiError } from '../api/client';

export function LoadingState({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <SpinnerIcon size={20} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon = 'empty',
  action,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  action?: React.ReactNode;
}) {
  return (
    <div className="state-block state-empty">
      <Icon name={icon} size={24} className="state-glyph" />
      <p className="state-title">{title}</p>
      {hint && <p className="state-hint">{hint}</p>}
      {action}
    </div>
  );
}

function TraceIdChip({ traceId }: { traceId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(traceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板被拒（非安全上下文 / 无权限）：id 本身在页面上可见，手选复制即可
      setCopied(false);
    }
  };

  return (
    <div className="trace-row">
      <span className="trace-label">追踪 ID</span>
      <code className="trace-id">{traceId}</code>
      <button type="button" className="btn btn-ghost btn-xs" onClick={copy}>
        <Icon name={copied ? 'confirm' : 'copy'} size={16} />
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

export function ErrorState({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  const err: ApiError = toApiError(error);
  const heading =
    title ??
    (err.isNetwork
      ? '网络连不上服务'
      : err.isUnauthorized
        ? '需要先登录'
        : err.isRateLimited
          ? '请求太频繁'
          : '请求失败');

  return (
    <div className="state-block state-error" role="alert">
      <div className="state-error-head">
        <Icon name="error" size={20} className="state-glyph-danger" />
        <div>
          <p className="state-title">{heading}</p>
          <p className="state-hint">
            {err.message}
            {err.code > 0 && <span className="state-code">（code {err.code}）</span>}
          </p>
        </div>
      </div>
      {err.traceId && <TraceIdChip traceId={err.traceId} />}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="reset" size={16} />
          重试
        </button>
      )}
    </div>
  );
}
