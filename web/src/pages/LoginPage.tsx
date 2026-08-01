import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function LoginPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whoami'] });
      nav('/');
    },
  });

  const canSubmit = username.trim() !== '' && password !== '' && !login.isPending;

  return (
    <section style={{ maxWidth: '420px', margin: '10vh auto 0', padding: 'var(--gutter-desktop)' }}>
      <header className="page-head">
        <div>
          <h1 className="page-title">MES 实训平台</h1>
          <p className="page-sub">
            制造业数字化学习平台。登录后你的学习进度将永久保存，不再因清缓存而丢失。
          </p>
        </div>
      </header>

      <form
        className="card"
        style={{ marginTop: 'var(--space-5)' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) login.mutate();
        }}
      >
        <label className="field">
          <span>用户名</span>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="field">
          <span>密码</span>
          <div className="input-affix">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? 'hide' : 'show'} size={16} />
            </button>
          </div>
        </label>

        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {login.isPending ? (
              <Icon name="loading" size={16} className="spin" />
            ) : (
              <Icon name="login" size={16} />
            )}
            登录
          </button>
        </div>
      </form>

      {login.isError && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <ErrorState error={login.error} title="登录失败" />
        </div>
      )}
    </section>
  );
}
