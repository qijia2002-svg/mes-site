/**
 * 个人中心：昵称编辑 + 学习进度汇总。
 * 昵称存 localStorage，进度数据复用 React Query 缓存。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { getNickname, setNickname } from '../components/GreetingBar';
import { api } from '../api/endpoints';

export default function ProfilePage() {
  const [nickname, setNicknameState] = useState(getNickname());
  const [saved, setSaved] = useState(false);

  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });

  const chapterQs = useQueries({
    queries: (topicsQ.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
    })),
  });

  const completedSet = new Set(
    (progressQ.data?.completedChapterIds ?? []).map((s) => String(s)),
  );
  const totalChapters = chapterQs.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
  const doneChapters = completedSet.size;
  const passedSql = progressQ.data?.passedExerciseIds?.length ?? 0;
  const pct = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;

  const handleSave = () => {
    setNickname(nickname.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">个人中心</h1>
          <p className="page-sub">管理你的个人信息和学习进度</p>
        </div>
      </header>

      {/* 昵称编辑 */}
      <div className="section">
        <h2 className="section-title">个人信息</h2>
        <div className="profile-form">
          <label className="profile-label" htmlFor="nickname">
            昵称（首页打招呼会用到）
          </label>
          <div className="profile-input-row">
            <input
              id="nickname"
              type="text"
              className="input"
              value={nickname}
              onChange={(e) => setNicknameState(e.target.value)}
              placeholder="输入你的昵称"
              maxLength={20}
            />
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              <Icon name="success" size={16} />
              保存
            </button>
          </div>
          {saved && (
            <p className="profile-saved">
              <Icon name="success" size={16} />
              已保存！首页会显示「{nickname}」
            </p>
          )}
        </div>
      </div>

      {/* 学习进度汇总 */}
      <div className="section">
        <h2 className="section-title">学习进度</h2>
        <div className="stat-row">
          <div className="stat">
            <span className="stat-value">{pct}%</span>
            <span className="stat-label">总进度</span>
          </div>
          <div className="stat">
            <span className="stat-value">{doneChapters}</span>
            <span className="stat-label">已学章节</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalChapters}</span>
            <span className="stat-label">总章节数</span>
          </div>
          <div className="stat">
            <span className="stat-value">{passedSql}</span>
            <span className="stat-label">SQL 通过</span>
          </div>
        </div>
      </div>

      {/* 各模块进度 */}
      {topicsQ.data && topicsQ.data.length > 0 && (
        <div className="section">
          <h2 className="section-title">各模块详情</h2>
          <ul className="row-list">
            {topicsQ.data
              .filter((t) => t.id <= 7)
              .map((t) => {
                const topicIdx = topicsQ.data!.indexOf(t);
                const chapters = chapterQs[topicIdx]?.data ?? [];
                const done = chapters.filter((c) => completedSet.has(String(c.id))).length;
                const total = chapters.length;
                const modulePct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <li key={t.id}>
                    <Link className="row-link" to={`/courses/${t.id}`}>
                      <span className="row-index">{modulePct}%</span>
                      <Icon name="courses" size={16} className="row-glyph" />
                      <span className="row-title">{t.title}</span>
                      <span className="row-meta">{done}/{total}</span>
                      <Icon name="chevron-right" size={16} className="row-glyph" />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* 管理入口 */}
      <div className="section">
        <Link className="btn btn-secondary btn-sm" to="/admin">
          <Icon name="admin" size={16} />
          管理后台
        </Link>
      </div>
    </section>
  );
}
