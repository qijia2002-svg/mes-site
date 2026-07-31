import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: () => nav('/admin'),
  });

  return (
    <section>
      <h2>登录</h2>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <input
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={login.isPending}>
          登录
        </button>
      </form>
      {login.isError && (
        <div className="sandbox-error">
          登录失败（需要有效的管理员凭证，且 worker 已配置 SESSION_SECRET）。
        </div>
      )}
    </section>
  );
}
