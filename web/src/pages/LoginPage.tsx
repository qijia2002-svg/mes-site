/**
 * 登录页（v2：高大上分栏 redesign）。
 * 左侧深色品牌面板介绍平台四大能力，右侧登录表单。
 * 全程 token 合规：深色背景用 --brand-ink，墨色上文字用 *-on-ink 系列；
 * 图标走项目锁定 Icon 体系，禁 emoji；无紫粉渐变、无硬编码色值。
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/StateBlock';
import { api } from '../api/endpoints';

const FEATURES = [
  { icon: 'factory', title: '工厂全景主线', desc: '从接单到发货的 15+ 真实环节，点开即学即练' },
  { icon: 'sql', title: 'SQL 沙盒实操', desc: '浏览器内真跑 SQL，即时判题纠错' },
  { icon: 'routing', title: '产线仿真搭建', desc: '拖出一张产线流程图，看物料怎么流动' },
  { icon: 'success', title: '进度永久保存', desc: '登录后学习数据云端同步，不怕清缓存' },
] as const;

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
    <div className="login-split">
      <aside className="login-brand">
        <div className="login-brand-top">
          <span className="login-brand-mark">
            <Icon name="workshop" size={24} />
          </span>
          <span className="login-brand-name">MES 实训平台</span>
        </div>

        <div className="login-brand-hero">
          <h1 className="login-brand-title">
            制造业数字化
            <br />
            学习实训平台
          </h1>
          <p className="login-brand-sub">
            把 MES / ERP / SQL / PLC 的零散知识，串成可上手的一条线。
          </p>
        </div>

        <ul className="login-features">
          {FEATURES.map((f) => (
            <li key={f.title} className="login-feature">
              <span className="login-feature-glyph">
                <Icon name={f.icon} size={20} />
              </span>
              <div>
                <p className="login-feature-title">{f.title}</p>
                <p className="login-feature-desc">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="login-brand-foot">Cloudflare Workers · D1 · Workers AI 驱动</p>
      </aside>

      <main className="login-form-wrap">
        <div className="login-form-card">
          <header className="login-form-head">
            <h2 className="login-form-title">欢迎回来</h2>
            <p className="login-form-sub">登录后你的学习进度将永久保存，不再因清缓存而丢失。</p>
          </header>

          <form
            className="login-form"
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

            <button className="btn btn-primary login-submit" type="submit" disabled={!canSubmit}>
              {login.isPending ? (
                <Icon name="loading" size={16} className="spin" />
              ) : (
                <Icon name="login" size={16} />
              )}
              登录
            </button>
          </form>

          {login.isError && (
            <div className="login-error">
              <ErrorState error={login.error} title="登录失败" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
