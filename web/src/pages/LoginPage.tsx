import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: () => nav('/admin'),
  });

  const canSubmit = username.trim() !== '' && password !== '' && !login.isPending;

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">管理员登录</h1>
          <p className="page-sub">
            学员不需要登录——章节、题库、判题都是匿名可用的。这里只用于内容后台。
          </p>
        </div>
      </header>

      <form
        className="card form-card"
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
        <div className="stack-top">
          <ErrorState error={login.error} title="登录失败" />
        </div>
      )}
    </section>
  );
}
