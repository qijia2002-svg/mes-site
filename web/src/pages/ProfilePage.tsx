/**
 * 个人中心 v4 — factory-first 口径。
 * 左栏：身份卡（工厂环节进度）+ 继续学习（下一环节）+ 工厂环节分布 + 账户设置
 * 右栏：练习活跃度（连续学习 / 热力图）+ 快捷入口
 * 课程/章节维度已从口径移除（产品主轴是工厂全景，不是章节）。
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon, type IconName } from '../components/Icon';
import { getProfile, setProfile } from '../lib/profileStore';
import { api } from '../api/endpoints';
import { useFactorySummary } from '../features/factory/useFactorySummary';
import { DEFAULT_FLOW, type Phase } from '../features/factory/factoryFlow.data';

const DAY_MS = 86_400_000;

const PHASE_LABEL: Record<Phase, string> = {
  plan: '计划',
  production: '生产',
  qc: '质检',
  logistics: '物流',
};

const DIRECTIONS = ['MES 实施工程师', 'MES 开发', '生产管理', '质量工程师'];

function computeLevel(practiced: number) {
  if (practiced < 3) return { n: '初学者', l: 1, next: 3 };
  if (practiced < 8) return { n: '探索者', l: 2, next: 8 };
  if (practiced < 15) return { n: '实践者', l: 3, next: 15 };
  if (practiced < 25) return { n: '专家', l: 4, next: 25 };
  return { n: '大师', l: 5, next: 40 };
}

function calcStreak(events: { createdAt?: number }[]): number {
  const s = new Set<string>();
  for (const e of events) {
    if (typeof e.createdAt === 'number') {
      const d = new Date(e.createdAt);
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  let st = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - (i + 1) * DAY_MS);
    if (s.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) st++;
    else break;
  }
  return st;
}

export default function ProfilePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const init = getProfile();
  const [nickname, setNick] = useState(init.nickname);
  const [direction, setDirection] = useState(init.direction);
  const [dailyGoal, setGoal] = useState(init.dailyGoal);
  const [reminder, setReminder] = useState(init.reminderTime);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('profile');

  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const summary = useFactorySummary();

  const sqlPassed = progressQ.data?.passedExerciseIds?.length ?? 0;
  const streak = calcStreak((progressQ.data as { events?: { createdAt?: number }[] } | undefined)?.events ?? []);

  // 真实练习热力图：按 createdAt 聚合到「天」，不依赖随机数据。
  const heatmap = useMemo(() => {
    const events = (progressQ.data as { events?: { createdAt?: number }[] } | undefined)?.events ?? [];
    const counts = new Map<string, number>();
    for (const e of events) {
      if (typeof e.createdAt === 'number') {
        const d = new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const cells: number[] = [];
    for (let i = 363; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const c = counts.get(key) ?? 0;
      cells.push(c >= 4 ? 3 : c >= 2 ? 2 : c >= 1 ? 1 : 0);
    }
    return cells;
  }, [progressQ.data]);

  const level = computeLevel(summary.practiced);
  const lvPct = Math.min(100, Math.round((Math.min(summary.practiced, level.next) / level.next) * 100));
  const initial = (nickname || '学').charAt(0);

  // 续学：下一环节（来自工厂进度），找不到则回落首个没碰过的。
  const nextNode = useMemo(() => {
    if (!summary.nextKey) return null;
    const n = (DEFAULT_FLOW.nodes ?? []).find((x) => x.key === summary.nextKey);
    return n ? { key: n.key, label: n.label } : null;
  }, [summary.nextKey]);

  const handleSave = () => {
    setProfile({
      nickname: nickname.trim(),
      direction: direction,
      dailyGoal: Number.isFinite(dailyGoal) && dailyGoal > 0 ? Math.round(dailyGoal) : 3,
      reminderTime: reminder,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    qc.setQueryData(['whoami'], null);
    nav('/login');
  };

  return (
    <section style={{ maxWidth: 1120, margin: '0 auto' }} className="profile-layout">
      <div className="page-head" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">个人中心</h1>
          <p className="page-sub">
            {direction || '制造数字化学习者'} · {level.n} Lv.{level.l}
          </p>
        </div>
        <Link to="/portfolio" className="btn btn-secondary btn-sm">
          <Icon name="chapter" size={16} /> 作品集
        </Link>
      </div>

      <div className="profile-grid">
        {/* ═══ LEFT ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}>
          {/* Identity */}
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 36,
                  fontWeight: 700,
                  flex: 'none',
                }}
              >
                {initial}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>{nickname || '学习者'}</h2>
                  <span className="tag">{level.n} Lv.{level.l}</span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 4 }}>
                  {level.l >= 5
                    ? `已练过 ${summary.practiced} 个环节 · 已达最高等级`
                    : `已练过 ${summary.practiced} 个环节 · 距 Lv.${level.l + 1} 还需 ${level.next - Math.min(summary.practiced, level.next)} 个`}
                </p>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                borderTop: '1px solid var(--border-soft)',
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
              }}
            >
              {[
                { icon: 'factory', v: `${summary.touched}`, l: '走过环节' },
                { icon: 'check-circle', v: `${summary.practiced}`, l: '练过环节' },
                { icon: 'sql', v: `${sqlPassed}`, l: 'SQL 通过' },
                { icon: 'streak', v: `${streak}`, l: '连续学习(天)' },
              ].map((s) => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)' }}>
                  <Icon name={s.icon as IconName} size={16} style={{ color: 'var(--meta)' }} />
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>{s.v}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{s.l}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* XP bar */}
            <div className="progress-track" style={{ height: 6, marginTop: 'var(--space-3)' }}>
              <div className="progress-fill" style={{ width: `${lvPct}%` }} />
            </div>
          </div>

          {/* Continue Learning */}
          <div className="panel">
            <h3 className="card-title">继续学习</h3>
            {nextNode ? (
              <Link
                to={`/factory?node=${encodeURIComponent(nextNode.key)}`}
                className="btn btn-primary"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Icon name="factory" size={16} /> 下一环节：{nextNode.label}
                </span>
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <div className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <Icon name="check-circle" size={16} /> 全部环节都练过了
              </div>
            )}
          </div>

          {/* Factory phase distribution */}
          <div className="panel">
            <h3 className="card-title">工厂环节分布</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {summary.phaseStats.map((p) => (
                <div key={p.phase}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--fg-2)', fontWeight: 'var(--weight-read)' }}>{PHASE_LABEL[p.phase]}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--meta)' }}>
                      {p.practiced}/{p.total} 练过 · {p.touched} 了解
                    </span>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div
                      className="progress-fill"
                      style={{ width: p.total > 0 ? `${(p.practiced / p.total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Settings */}
          <div className="panel">
            <h3 className="card-title">账户设置</h3>
            <div
              className="tabs"
              style={{ display: 'flex', gap: 'var(--space-5)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-5)' }}
            >
              {[
                { k: 'profile', l: '资料' },
                { k: 'goal', l: '学习目标' },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 'var(--space-3) 0',
                    font: 'inherit',
                    fontSize: 'var(--text-base)',
                    color: tab === t.k ? 'var(--fg)' : 'var(--muted)',
                    cursor: 'pointer',
                    fontWeight: 'var(--weight-emph-cjk)',
                    position: 'relative',
                  }}
                >
                  {t.l}
                  {tab === t.k && (
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
                  )}
                </button>
              ))}
            </div>
            {tab === 'profile' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', maxWidth: 560 }}>
                  <label className="field">
                    <span>昵称</span>
                    <input className="input" value={nickname} onChange={(e) => setNick(e.target.value)} maxLength={20} />
                  </label>
                  <label className="field">
                    <span>学习方向</span>
                    <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                      <option value="">未设置</option>
                      {DIRECTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}>
                    <Icon name="success" size={16} /> 保存设置
                  </button>
                  {saved && (
                    <span style={{ color: 'var(--success)', fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="success" size={16} /> 已保存
                    </span>
                  )}
                </div>
              </div>
            )}
            {tab === 'goal' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', maxWidth: 560 }}>
                  <label className="field">
                    <span>每日学习目标（个/天）</span>
                    <input className="input" type="number" min={1} max={20} value={dailyGoal} onChange={(e) => setGoal(Number(e.target.value))} />
                  </label>
                  <label className="field">
                    <span>学习提醒时间</span>
                    <input className="input" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
                  </label>
                </div>
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}>
                    <Icon name="success" size={16} /> 保存设置
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT RAIL ═══ */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Practice activity + Streak */}
          <div className="panel">
            <h3 className="card-title">练习活跃度 & 连续学习</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>
              <span>
                每日目标 <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color: 'var(--fg)' }}>{dailyGoal}</b> 个/天
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warn)' }}>
                <Icon name="streak" size={16} /> 连续 <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color: 'var(--fg)' }}>{streak}</b> 天
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateRows: 'repeat(7, 11px)',
                gap: 3,
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)',
              }}
            >
              {heatmap.map((lvl, i) => (
                <div
                  key={i}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    background:
                      lvl === 3
                        ? 'var(--accent-active)'
                        : lvl === 2
                          ? 'color-mix(in srgb, var(--accent) 80%, transparent)'
                          : lvl === 1
                            ? 'color-mix(in srgb, var(--accent) 50%, transparent)'
                            : 'var(--surface-3)',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--meta)', marginTop: 'var(--space-2)' }}>
              少{' '}
              <span style={{ display: 'inline-flex', gap: 3 }}>
                <i style={{ width: 11, height: 11, borderRadius: 2, background: 'var(--surface-3)' }} />
                <i style={{ width: 11, height: 11, borderRadius: 2, background: 'color-mix(in srgb, var(--accent) 50%, transparent)' }} />
                <i style={{ width: 11, height: 11, borderRadius: 2, background: 'color-mix(in srgb, var(--accent) 80%, transparent)' }} />
                <i style={{ width: 11, height: 11, borderRadius: 2, background: 'var(--accent-active)' }} />
              </span>{' '}
              多
            </div>
          </div>

          {/* Quick links */}
          <div className="panel">
            <h3 className="card-title">快捷入口</h3>
            <Link
              to="/factory"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', textDecoration: 'none' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--muted)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name="factory" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-base)' }}>工厂全景</span>
              </div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--meta)' }} />
            </Link>
            <Link
              to="/admin"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', textDecoration: 'none' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--muted)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name="admin" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-base)' }}>后台管理</span>
              </div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--meta)' }} />
            </Link>
            <div
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--danger)', marginTop: 4 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name="logout" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-base)' }}>退出登录</span>
              </div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--meta)' }} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
