/**
 * 个人中心 v2 — 智造学院风格：头像 + 等级 + 统计 + 技能条 + 课程列表 + 设置项。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { getProfile, setProfile } from '../lib/profileStore';
import { getPortfolio, addPortfolioItem, removePortfolioItem, type PortfolioItem, type PortfolioCategory } from '../lib/portfolioStore';
import { api } from '../api/endpoints';

const DAY_MS = 86_400_000;

function computeLevel(done: number): { name: string; lv: number; nextLv: number } {
  if (done < 10) return { name: '初学者', lv: 1, nextLv: 10 };
  if (done < 30) return { name: '探索者', lv: 2, nextLv: 30 };
  if (done < 60) return { name: '实践者', lv: 3, nextLv: 60 };
  if (done < 100) return { name: '专家', lv: 4, nextLv: 100 };
  return { name: '大师', lv: 5, nextLv: 200 };
}

/** 技能条组件 */
function SkillBar({ name, pct, color }: { name: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--fg-2)' }}>{name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)', color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--radius-pill)', transition: 'width 1.2s var(--ease-out)', transformOrigin: 'left', animation: 'skillGrow 1.2s var(--ease-out) forwards' }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const initial = getProfile();
  const [nickname, setNicknameState] = useState(initial.nickname);
  const [dailyGoal, setDailyGoal] = useState(initial.dailyGoal);
  const [reminderTime, setReminderTime] = useState(initial.reminderTime);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // 作品集 / 求职素材（本地存储，Manufacturing OS P1）
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => getPortfolio());
  const [pfTitle, setPfTitle] = useState('');
  const [pfCategory, setPfCategory] = useState<PortfolioCategory>('需求文档');
  const [pfDate, setPfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pfNote, setPfNote] = useState('');
  const [pfError, setPfError] = useState(false);

  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });
  const chapterQs = useQueries({
    queries: (topicsQ.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
    })),
  });

  const completedSet = useMemo(
    () => new Set((progressQ.data?.completedChapterIds ?? []).map(String)),
    [progressQ.data],
  );
  const totalChapters = chapterQs.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
  const doneChapters = completedSet.size;
  const passedSql = progressQ.data?.passedExerciseIds?.length ?? 0;
  const pct = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;
  const level = computeLevel(doneChapters);
  const levelProgress = Math.min(100, Math.round((Math.min(doneChapters, level.nextLv) / level.nextLv) * 100));

  // 计算连续学习天数
  const streak = useMemo(() => {
    const events = (progressQ.data as any)?.events ?? [];
    const daySet = new Set<string>();
    for (const e of events) {
      if (typeof e.createdAt === 'number') {
        const d = new Date(e.createdAt);
        daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getTime() - (i + 1) * DAY_MS);
      if (daySet.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) s++;
      else break;
    }
    return s;
  }, [progressQ.data]);

  // 模块技能百分比
  const moduleStats = useMemo(() => {
    return (topicsQ.data ?? [])
      .map((t, i) => {
        const chs = chapterQs[i]?.data ?? [];
        const done = chs.filter((c) => completedSet.has(String(c.id))).length;
        return { id: t.id, name: t.title, done, total: chs.length, pct: chs.length > 0 ? Math.round((done / chs.length) * 100) : 0 };
      });
  }, [topicsQ.data, chapterQs, completedSet]);

  const userInitial = nickname ? nickname.charAt(0) : '学';

  const handleSave = () => {
    const res = setProfile({
      nickname: nickname.trim(),
      dailyGoal: Number.isFinite(dailyGoal) && dailyGoal > 0 ? Math.round(dailyGoal) : 3,
      reminderTime,
    });
    if (!res.ok) {
      // 浏览器存储不可用（无痕模式 / 站点权限禁用）——明确告知用户，而非静默"已保存"。
      setSaveError(true);
      return;
    }
    setSaveError(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddPortfolio = () => {
    if (!pfTitle.trim()) return;
    const res = addPortfolioItem({
      title: pfTitle.trim(),
      category: pfCategory,
      note: pfNote.trim(),
      date: pfDate || new Date().toISOString().slice(0, 10),
    });
    if (!res.ok) {
      // 存储禁用（无痕 / 站点权限）——明确报错，不静默。
      setPfError(true);
      return;
    }
    setPfError(false);
    setPortfolio(res.items);
    setPfTitle('');
    setPfNote('');
    setPfCategory('需求文档');
    setPfDate(new Date().toISOString().slice(0, 10));
  };

  const handleDeletePortfolio = (id: string) => {
    const res = removePortfolioItem(id);
    if (!res.ok) {
      setPfError(true);
      return;
    }
    setPfError(false);
    setPortfolio(res.items);
  };

  return (
    <section style={{ maxWidth: 760 }}>
      {/* ═══ 个人卡片 ═══ */}
      <div className="panel" style={{ padding: 'var(--space-6)', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 头像 */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff', flex: 'none',
          }}>
            {userInitial}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--fg)' }}>
                {nickname || '学习者'}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)' }}>
                {level.name} Lv.{level.lv}
              </span>
            </div>

            {/* 4 统计数字 */}
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
              {[
                { icon: 'schedule' as const, value: `${doneChapters}h`, label: '学习章节' },
                { icon: 'success' as const, value: `${passedSql}`, label: 'SQL 通过' },
                { icon: 'streak' as const, value: `${streak}`, label: '连续学习(天)' },
                { icon: 'stage' as const, value: `${topicsQ.data?.length ?? 0}`, label: '课程数' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name={s.icon} size={16} style={{ color: 'var(--meta)' }} />
                  <div>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--fg)' }}>{s.value}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginLeft: 4 }}>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 等级进度 */}
          <div style={{ textAlign: 'center', flex: 'none' }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
              {doneChapters}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>已学章节</div>
          </div>
        </div>

        {/* XP 进度条 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>
            <span>{level.name} Lv.{level.lv}</span>
            <span>距 Lv.{level.lv + 1} 还需 {level.nextLv - Math.min(doneChapters, level.nextLv)} 章</span>
          </div>
          <div className="dash-goal-bar" style={{ height: 6 }}>
            <div className="dash-goal-fill" style={{ width: `${levelProgress}%` }} />
          </div>
        </div>

      </div>

      {/* ═══ 技能雷达 ═══ */}
      {moduleStats.length > 0 && (
        <div className="panel" style={{ marginTop: 'var(--space-5)' }}>
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>学习技能</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            {moduleStats.map((m) => {
              const color = m.pct >= 80 ? 'var(--success)' : m.pct >= 40 ? 'var(--accent)' : m.pct > 0 ? 'var(--warn)' : 'var(--meta)';
              return <SkillBar key={m.id} name={m.name} pct={m.pct} color={color} />;
            })}
          </div>
        </div>
      )}

      {/* ═══ 我的课程 ═══ */}
      {moduleStats.length > 0 && (
        <div className="panel" style={{ marginTop: 'var(--space-5)' }}>
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>我的课程</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {moduleStats.slice(0, 5).map((m) => {
              const isDone = m.total > 0 && m.done >= m.total;
              const isDoing = m.done > 0 && m.done < m.total;
              const barColor = isDone ? 'var(--success)' : isDoing ? 'var(--warn)' : 'var(--border)';
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-soft)',
                }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: barColor, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/courses/${m.id}`} style={{
                      fontSize: 'var(--text-base)', fontWeight: 'var(--weight-announce-cjk)', color: 'var(--fg)',
                      textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.name}
                    </Link>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>
                      {m.done}/{m.total} 章 · {m.pct}%
                    </span>
                  </div>
                  <Link className={`btn btn-sm ${isDone ? 'btn-secondary' : isDoing ? 'btn-primary' : 'btn-ghost'}`} to={`/courses/${m.id}`}>
                    {isDone ? '复习' : isDoing ? '继续' : '开始'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 设置（可编辑并保存） ═══ */}
      <div className="panel" style={{ marginTop: 'var(--space-5)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>设置</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label className="field" style={{ margin: 0 }}>
            <span>昵称</span>
            <input
              className="input"
              type="text"
              value={nickname}
              onChange={(e) => setNicknameState(e.target.value)}
              placeholder="输入你的昵称"
              maxLength={20}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span>每日学习目标（章/天）</span>
            <input
              className="input"
              type="number"
              min={1}
              max={20}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span>学习提醒时间</span>
            <input
              className="input"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
              <Icon name="success" size={16} /> 保存设置
            </button>
            {saved && (
              <span className="profile-saved" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="success" size={16} /> 已保存
              </span>
            )}
            {saveError && (
              <span className="profile-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="error" size={16} /> 保存失败：浏览器存储不可用（请关闭无痕模式或允许本站存储）
              </span>
            )}
          </div>
        </div>

        <Link className="btn btn-secondary btn-sm" to="/admin" style={{ marginTop: 'var(--space-4)' }}>
          <Icon name="admin" size={16} /> 管理后台
        </Link>
      </div>

      {/* ═══ 作品集 / 求职素材（Manufacturing OS P1） ═══ */}
      <div className="panel" style={{ marginTop: 'var(--space-5)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="portfolio" size={20} /> 作品集 / 求职素材
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', marginBottom: 'var(--space-4)' }}>
          沉淀 MES 需求文档、实施笔记、方案设计，作为求职作品集。数据仅存于本机浏览器。
        </p>

        {/* 添加表单 */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
            <input
              className="input"
              type="text"
              placeholder="作品标题，如：XX 工厂 MES 需求调研"
              value={pfTitle}
              onChange={(e) => setPfTitle(e.target.value)}
              maxLength={60}
            />
            <select
              className="input"
              value={pfCategory}
              onChange={(e) => setPfCategory(e.target.value as PortfolioCategory)}
            >
              {(['需求文档', '实施笔记', '方案', '其他'] as PortfolioCategory[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <input
            className="input"
            type="date"
            value={pfDate}
            onChange={(e) => setPfDate(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <textarea
            className="input"
            placeholder="备注 / 亮点 / 技术栈（可选）"
            value={pfNote}
            onChange={(e) => setPfNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAddPortfolio}
              disabled={!pfTitle.trim()}
            >
              <Icon name="add" size={16} /> 添加作品
            </button>
            {pfError && (
              <span className="profile-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="error" size={16} /> 保存失败：浏览器存储不可用（请关闭无痕模式或允许本站存储）
              </span>
            )}
          </div>
        </div>

        {/* 列表 */}
        {portfolio.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--meta)' }}>
            <Icon name="empty" size={24} style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ fontSize: 'var(--text-sm)' }}>还没有作品，添加第一条开始沉淀你的求职素材吧。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {portfolio.map((item) => (
              <div key={item.id} style={{
                display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                padding: 'var(--space-3)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'var(--weight-announce-cjk)', color: 'var(--fg)', fontSize: 'var(--text-base)' }}>
                      {item.title}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-3)', color: 'var(--accent)',
                    }}>
                      {item.category}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{item.date}</span>
                  </div>
                  {item.note && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {item.note}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeletePortfolio(item.id)}
                  aria-label="删除作品"
                  title="删除作品"
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
