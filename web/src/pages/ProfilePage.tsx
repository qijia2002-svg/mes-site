/**
 * 个人中心 v3 — 基于 profile-center-preview.html 重设计。
 * 左栏：身份卡 + 继续学习 + 我的课程 + 技能 + 账户设置
 * 右栏：学习热力图 + 账号快捷 + 作品集入口
 * 作品集已独立为 /portfolio 页。
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { getProfile, setProfile } from '../lib/profileStore';
import { api } from '../api/endpoints';

const DAY_MS = 86_400_000;

function computeLevel(d: number) {
  if (d < 10) return { n: '初学者', l: 1, next: 10 };
  if (d < 30) return { n: '探索者', l: 2, next: 30 };
  if (d < 60) return { n: '实践者', l: 3, next: 60 };
  if (d < 100) return { n: '专家', l: 4, next: 100 };
  return { n: '大师', l: 5, next: 200 };
}

function calcStreak(events: any[]): number {
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
    if (s.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) st++; else break;
  }
  return st;
}

export default function ProfilePage() {
  const nav = useNavigate(); const qc = useQueryClient();
  const init = getProfile();
  const [nickname, setNick] = useState(init.nickname);
  const [dailyGoal, setGoal] = useState(init.dailyGoal);
  const [reminder, setReminder] = useState(init.reminderTime);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('profile');

  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });
  const chapterQs = useQueries({
    queries: (topicsQ.data ?? []).map(t => ({ queryKey: ['chapters', t.id], queryFn: () => api.chapters(t.id), staleTime: 5 * 60_000 })),
  });

  const cs = useMemo(() => new Set((progressQ.data?.completedChapterIds ?? []).map(String)), [progressQ.data]);
  const done = cs.size;
  const total = chapterQs.reduce((s, q) => s + (q.data?.length ?? 0), 0);
  const sqlPassed = progressQ.data?.passedExerciseIds?.length ?? 0;
  const streak = calcStreak((progressQ.data as any)?.events ?? []);

  // 真实学习热力图：按 createdAt 聚合到「天」，不依赖随机数据；用 useMemo 避免每次渲染抖动。
  const heatmap = useMemo(() => {
    const events = (progressQ.data as any)?.events ?? [];
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
  const level = computeLevel(done);
  const lvPct = Math.min(100, Math.round((Math.min(done, level.next) / level.next) * 100));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const initial = (nickname || '学').charAt(0);

  const moduleStats = useMemo(() => (topicsQ.data ?? []).map((t, i) => {
    const chs = chapterQs[i]?.data ?? [];
    const d = chs.filter(c => cs.has(String(c.id))).length;
    return { id: t.id, name: t.title, done: d, total: chs.length, pct: chs.length > 0 ? Math.round((d / chs.length) * 100) : 0 };
  }), [topicsQ.data, chapterQs, cs]);

  const doingCourses = moduleStats.filter(m => m.total > 0 && m.done > 0 && m.done < m.total).slice(0, 4);
  const allCourses = moduleStats.slice(0, 6);

  const handleSave = () => {
    setProfile({ nickname: nickname.trim(), dailyGoal: Number.isFinite(dailyGoal) && dailyGoal > 0 ? Math.round(dailyGoal) : 3, reminderTime: reminder });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    qc.setQueryData(['whoami'], null);
    nav('/login');
  };

  return (
    <section style={{ maxWidth: 1120, margin: '0 auto' }} className="profile-layout">
      <div className="page-head" style={{ marginBottom: 'var(--space-6)' }}>
        <div><h1 className="page-title">个人中心</h1><p className="page-sub">MES 实施方向 · {level.n} Lv.{level.l}</p></div>
        <Link to="/portfolio" className="btn btn-secondary btn-sm"><Icon name="chapter" size={16} /> 作品集</Link>
      </div>

      <div className="profile-grid">
        {/* ═══ LEFT ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}>
          {/* Identity */}
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 700, flex: 'none' }}>{initial}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>{nickname || '学习者'}</h2>
                  <span className="tag">{level.n} Lv.{level.l}</span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 4 }}>
                {level.l >= 5
                  ? `已学习 ${streak} 天 · 已达最高等级`
                  : `已学习 ${streak} 天 · 距 Lv.${level.l + 1} 还需 ${level.next - Math.min(done, level.next)} 章`}
              </p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)' }}>
              {[{ icon: 'chapter', v: `${done}`, l: '学习章节' }, { icon: 'sql', v: `${sqlPassed}`, l: 'SQL 通过' }, { icon: 'streak', v: `${streak}`, l: '连续学习(天)' }, { icon: 'courses', v: `${total}`, l: '总章节' }].map(s => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)' }}>
                  <Icon name={s.icon as any} size={16} style={{ color: 'var(--meta)' }} />
                  <div><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>{s.v}</span><span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{s.l}</span></div>
                </div>
              ))}
            </div>
            {/* XP bar */}
            <div className="progress-track" style={{ height: 6, marginTop: 'var(--space-3)' }}><div className="progress-fill" style={{ width: `${lvPct}%` }} /></div>
          </div>

          {/* Continue Learning */}
          {doingCourses.length > 0 && (
            <div className="panel">
              <h3 className="card-title">继续学习</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
                {doingCourses.slice(0, 2).map(m => (
                  <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}><Icon name="courses" size={16} /></div>
                      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)' }}>{m.name}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>下一节：继续完成剩余 {m.total - m.done} 章</div>
                    <div className="progress-track" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${m.pct}%` }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', fontFamily: 'var(--font-mono)' }}>{m.done}/{m.total} 章</span>
                      <Link className="btn btn-primary btn-sm" to={`/courses/${m.id}`}>继续</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Courses */}
          <div className="panel">
            <h3 className="card-title">我的课程</h3>
            {allCourses.map(m => {
              const isDone = m.total > 0 && m.done >= m.total;
              const isDoing = m.done > 0 && m.done < m.total;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)', flex: 'none' }}><Icon name="courses" size={16} /></div>
                  <div style={{ flex: 1 }}><Link to={`/courses/${m.id}`} style={{ fontWeight: 'var(--weight-announce-cjk)', color: 'var(--fg)', textDecoration: 'none' }}>{m.name}</Link><span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', display: 'block' }}>{m.done}/{m.total} 章 · {m.pct}%</span></div>
                  <div style={{ width: 120, flex: 'none' }}>
                    <div className="progress-track" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${m.pct}%`, background: isDone ? 'var(--success)' : isDoing ? 'var(--accent)' : 'var(--border)' }} /></div>
                    <span style={{ fontSize: 11, color: 'var(--meta)', display: 'block', marginTop: 4, textAlign: 'right' }}>{isDone ? '已完成' : isDoing ? '进行中' : '未开始'}</span>
                  </div>
                  <Link className={`btn btn-sm ${isDone ? 'btn-secondary' : isDoing ? 'btn-primary' : 'btn-ghost'}`} to={`/courses/${m.id}`}>{isDone ? '复习' : isDoing ? '继续' : '开始'}</Link>
                </div>
              );
            })}
          </div>

          {/* Skills */}
          <div className="panel">
            <h3 className="card-title">技能掌握</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              {moduleStats.slice(0, 6).map(m => {
                const c = m.pct >= 80 ? 'var(--success)' : m.pct >= 40 ? 'var(--accent)' : m.pct > 0 ? 'var(--warn)' : 'var(--meta)';
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--fg-2)' }}>{m.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color: c }}>{m.pct}%</span>
                    </div>
                    <div className="progress-track" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${m.pct}%`, background: c }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account Settings */}
          <div className="panel">
            <h3 className="card-title">账户设置</h3>
            <div className="tabs" style={{ display: 'flex', gap: 'var(--space-5)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-5)' }}>
              {[{ k: 'profile', l: '资料' }, { k: 'goal', l: '学习目标' }, { k: 'notify', l: '通知' }].map(t => (
                <button key={t.k} onClick={() => setTab(t.k)} style={{ background: 'none', border: 0, padding: 'var(--space-3) 0', font: 'inherit', fontSize: 'var(--text-base)', color: tab === t.k ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontWeight: 'var(--weight-emph-cjk)', position: 'relative' }}>
                  {t.l}
                  {tab === t.k && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--accent)', borderRadius: 2 }} />}
                </button>
              ))}
            </div>
            {tab === 'profile' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', maxWidth: 560 }}>
                  <label className="field"><span>昵称</span><input className="input" value={nickname} onChange={e => setNick(e.target.value)} maxLength={20} /></label>
                  <label className="field"><span>学习方向</span><select className="input"><option>MES 实施工程师</option><option>MES 开发</option><option>生产管理</option><option>质量工程师</option></select></label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}><Icon name="success" size={16} /> 保存设置</button>
                  {saved && <span style={{ color: 'var(--success)', fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="success" size={16} /> 已保存</span>}
                </div>
              </div>
            )}
            {tab === 'goal' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', maxWidth: 560 }}>
                  <label className="field"><span>每日学习目标（章/天）</span><input className="input" type="number" min={1} max={20} value={dailyGoal} onChange={e => setGoal(Number(e.target.value))} /></label>
                  <label className="field"><span>学习提醒时间</span><input className="input" type="time" value={reminder} onChange={e => setReminder(e.target.value)} /></label>
                </div>
                <div style={{ marginTop: 'var(--space-5)' }}><button className="btn btn-primary btn-sm" onClick={handleSave}><Icon name="success" size={16} /> 保存设置</button></div>
              </div>
            )}
            {tab === 'notify' && (
              <div>
                {[{ l: '学习提醒', s: '按设定时间推送每日学习目标提醒', on: true }, { l: '课程更新', s: '已选课程新增章节时通知', on: true }, { l: '产品动态', s: '平台功能与活动资讯', on: false }].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <div><span style={{ fontSize: 'var(--text-base)', color: 'var(--fg-2)' }}>{r.l}</span><span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 2 }}>{r.s}</span></div>
                    <div style={{ width: 40, height: 24, borderRadius: 'var(--radius-pill)', background: r.on ? 'var(--accent)' : 'var(--surface-3)', border: '1px solid var(--border-strong)', position: 'relative', cursor: 'pointer', flex: 'none', transition: 'background var(--motion-fast)' }}>
                      <div style={{ position: 'absolute', top: 2, left: r.on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left var(--motion-fast) var(--ease-out)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT RAIL ═══ */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Goal + Streak */}
          <div className="panel">
            <h3 className="card-title">学习目标 & 连续学习</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>
              <span>每日目标 <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color: 'var(--fg)' }}>{dailyGoal}</b> 章/天</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warn)' }}><Icon name="streak" size={16} /> 连续 <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color: 'var(--fg)' }}>{streak}</b> 天</span>
            </div>
            <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 11px)', gap: 3, overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
              {heatmap.map((lvl, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: lvl === 3 ? 'var(--accent-active)' : lvl === 2 ? 'color-mix(in srgb, var(--accent) 80%, transparent)' : lvl === 1 ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--surface-3)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--meta)', marginTop: 'var(--space-2)' }}>少 <span style={{ display: 'inline-flex', gap: 3 }}><i style={{ width: 11, height: 11, borderRadius: 2, background: 'var(--surface-3)' }} /><i style={{ width: 11, height: 11, borderRadius: 2, background: 'color-mix(in srgb, var(--accent) 50%, transparent)' }} /><i style={{ width: 11, height: 11, borderRadius: 2, background: 'color-mix(in srgb, var(--accent) 80%, transparent)' }} /><i style={{ width: 11, height: 11, borderRadius: 2, background: 'var(--accent-active)' }} /></span> 多</div>
          </div>

          {/* Quick links */}
          <div className="panel">
            <h3 className="card-title">快捷入口</h3>
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', textDecoration: 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--muted)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="admin" size={16} /></div>
              <div style={{ flex: 1 }}><span style={{ fontSize: 'var(--text-base)' }}>后台管理</span></div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--meta)' }} />
            </Link>
            <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--danger)', marginTop: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="logout" size={16} /></div>
              <div style={{ flex: 1 }}><span style={{ fontSize: 'var(--text-base)' }}>退出登录</span></div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--meta)' }} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
