/**
 * 全局错误边界：兜住任何渲染期抛错（如组件 bug、类型越界），
 * 不再白屏，而是显示可读的错误卡片 + 一键重试/回首页。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 仅打到控制台，便于用户/开发者报障时定位
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const { error } = this.state;
    return (
      <div
        role="alert"
        style={{
          maxWidth: 560,
          margin: '12vh auto 0',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>页面出错了</span>
        </div>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
          {error.message || '发生未知错误'}
        </p>
        <pre
          style={{
            margin: 0,
            padding: 'var(--space-3)',
            background: 'var(--surface-3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            color: 'var(--fg-2)',
            overflow: 'auto',
            maxHeight: 200,
          }}
        >
          {error.stack?.split('\n').slice(0, 6).join('\n')}
        </pre>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={this.reset}>
            重试
          </button>
          <a className="btn btn-secondary btn-sm" href="/">
            返回首页
          </a>
        </div>
      </div>
    );
  }
}
