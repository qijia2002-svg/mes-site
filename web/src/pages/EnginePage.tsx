/**
 * 智造学院 · 学习引擎 v3
 *
 * 功能：
 *   1. 路径选择器（tabs）+ 完成度大数字 + 继承横幅
 *   2. 阶段视图（阶段卡片 + 解锁状态）
 *   3. 课程列表（6种状态：completed/inherited/doing/locked/pending/skipped）
 *   4. 路径切换面板（继承收益预览 + 确认）
 *   5. 课程操作（继续/开始/跳过/重学/复习）
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';

import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type CourseState, type EngineStatus, type PathSummary, type StageSummary } from '../api/endpoints';

const SK_ACTIVE = 'mes.engine.activePath';
const SK_SELECTED = 'mes.engine.selectedPaths';
const SK_SKIPPED = 'mes.engine.skipped';

function getStored<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function setStored(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* */ } }

function statusIcon(s: string) {
  switch (s) {
    case 'completed':  return <Icon name="success" size={20} />;
    case 'inherited':  return <Icon name="success" size={20} />;
    case 'skipped':    return <Icon name="hide" size={20} />;
    case 'doing':      return <Icon name="run" size={20} />;
    case 'locked':     return <Icon name="hide" size={20} />;
    default:           return <Icon name="chapter" size={20} />;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'completed': return '已完成'; case 'inherited': return '已继承';
    case 'skipped':   return '已跳过'; case 'doing':     return '进行中';
    case 'locked':    return '未解锁'; default:           return '待学习';
  }
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed': return 'var(--success)'; case 'inherited': return 'var(--warn)';
    case 'skipped':   return 'var(--meta)';    case 'doing':     return 'var(--warn)';
    case 'locked':    return 'var(--meta)';    default:          return 'var(--accent)';
  }
}

function statusBadge(s: string): string {
  switch (s) {
    case 'completed': return 'pill-ok'; case 'inherited': return 'pill-warn';
    case 'skipped':   return '';        case 'doing':     return 'pill-warn';
    case 'locked':    return '';        default:          return '';
  }
}

// ─── 主页面 ───
export default function EnginePage() {
  const qc = useQueryClient();
  const [activePath, setActivePath] = useState<number | undefined>(getStored(SK_ACTIVE, undefined));
  const [selectedPaths, setSelectedPaths] = useState<number[]>(getStored(SK_SELECTED, []));
  const [skippedIds, setSkippedIds] = useState<number[]>(getStored(SK_SKIPPED, []));
  const [previewPathId, setPreviewPathId] = useState<number | null>(null);

  const engineQ = useQuery({
    queryKey: ['engine-status', activePath, selectedPaths, skippedIds],
    queryFn: () => api.engineStatus({
      activePath, selectedPaths: selectedPaths.length > 0 ? selectedPaths : [1,2,3,4,5],
      skippedCourseIds: skippedIds.length > 0 ? skippedIds : undefined,
    }),
    staleTime: 30_000,
    retry: 1,
  });

  const data = engineQ.data;

  // 自动初始化
  useEffect(() => {
    if (!activePath && data && data.paths.length > 0) {
      const first = data.paths[0];
      setSelectedPaths((prev) => prev.length > 0 ? prev : [first.pathId]);
      setActivePath(first.pathId);
      setStored(SK_ACTIVE, first.pathId);
    }
  }, [data, activePath]);

  const switchPath = useCallback((pathId: number) => {
    const newSel = selectedPaths.includes(pathId) ? selectedPaths : [...selectedPaths, pathId];
    setSelectedPaths(newSel); setStored(SK_SELECTED, newSel);
    setActivePath(pathId); setStored(SK_ACTIVE, pathId);
    setPreviewPathId(null);
    qc.invalidateQueries({ queryKey: ['engine-status'] });
  }, [selectedPaths, qc]);

  const skipCourse = useCallback((courseId: number) => {
    const next = [...skippedIds, courseId];
    setSkippedIds(next); setStored(SK_SKIPPED, next);
  }, [skippedIds]);

  const unskipCourse = useCallback((courseId: number) => {
    const next = skippedIds.filter(id => id !== courseId);
    setSkippedIds(next); setStored(SK_SKIPPED, next);
  }, [skippedIds]);

  if (engineQ.isLoading) return <LoadingState label="正在分析学习数据…" />;
  if (engineQ.isError) return <ErrorState error={engineQ.error} onRetry={() => void engineQ.refetch()} />;
  if (!data || data.paths.length === 0) {
    return <EmptyState title="还没有学习路径" hint="后台配置学习路径后，这里会出现智能学习引擎。" icon="paths" />;
  }

  const activePathData = data.paths.find(p => p.pathId === activePath);
  const previewPathData = previewPathId ? data.paths.find(p => p.pathId === previewPathId) : null;

  return (
    <section style={{ maxWidth: 880 }}>
      {/* ═══ 路径选择器 ═══ */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {data.paths.map(p => (
            <button key={p.pathId} type="button"
              className={`btn btn-sm ${p.pathId === activePath ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => p.pathId !== activePath ? setPreviewPathId(p.pathId) : undefined}>
              {p.name} ({p.completion}%)
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Link to="/roadmap" className="text-link" style={{ fontSize: 'var(--text-sm)' }}>
            <Icon name="stage" size={16} /> 查看全部职业路径
          </Link>
        </div>
      </div>

      {/* ═══ 继承横幅 ═══ */}
      {data.banner.show && (
        <div className="alert alert-ok" style={{ marginBottom: 'var(--space-4)' }}>
          <Icon name="streak" size={20} className="alert-glyph" />
          <div>
            <strong>你之前的「{data.banner.sourcePathName}」学习中已完成 {data.banner.inheritedCount} 门课程</strong>
            <span className="alert-sub">
              这些课程在当前路径同样适用，已自动继承。可节省约 {data.banner.savedHours} 小时学习时间。
            </span>
          </div>
        </div>
      )}

      {/* ═══ 路径切换预览 ═══ */}
      {previewPathData && previewPathData.pathId !== activePath && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}>
          <Icon name="info" size={16} className="alert-glyph" />
          <div>
            <strong>切换预览：{previewPathData.name}</strong>
            <div className="alert-sub">
              继承 {previewPathData.inheritedCount} 门已学课程 / 剩余 {previewPathData.newCount} 门新课程
              {' · '}完成度 {previewPathData.completion}%
              {' · '}可节省约 {previewPathData.savedHours} 小时
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button className="btn btn-primary btn-sm" onClick={() => switchPath(previewPathData.pathId)}>
                确认切换到此路径
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewPathId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 完成度 + 下一门课 CTA ═══ */}
      {activePathData && (
        <div className="card" style={{
          padding: 'var(--space-6)', display: 'flex', flexWrap: 'wrap',
          gap: 'var(--space-6)', alignItems: 'center', marginBottom: 'var(--space-5)',
        }}>
          <div style={{ textAlign: 'center', flex: 'none', minWidth: 100 }}>
            <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', lineHeight: 1 }}>
              {data.completion}%
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', marginTop: 4 }}>{activePathData.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 2 }}>
              继承{activePathData.inheritedCount} · 新学{activePathData.newCount} · {activePathData.totalCount}门课
            </div>
          </div>

          {data.nextCourse ? (
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)' }}>
                {data.nextCourse.status === 'doing' ? '继续学习' : data.nextCourse.status === 'inherited' ? '继承课程' : '下一门课'}
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)', marginBottom: 'var(--space-2)' }}>
                {data.nextCourse.name}
                {' '}<span className="tag" style={{ background: statusColor(data.nextCourse.status) + '20', color: statusColor(data.nextCourse.status), borderColor: statusColor(data.nextCourse.status) + '40' }}>
                  {statusLabel(data.nextCourse.status)}
                </span>
              </div>
              {data.nextCourse.status === 'doing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>{data.nextCourse.percent}%</span>
                  <div className="progress-track" style={{ flex: 1, height: 6 }}><div className="progress-fill" style={{ width: `${data.nextCourse.percent}%` }} /></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {data.nextCourse.status === 'doing' || data.nextCourse.status === 'pending' ? (
                  <Link className="btn btn-primary" to={`/courses/${data.nextCourse.courseId}`}>
                    <Icon name="run" size={16} /> {data.nextCourse.status === 'doing' ? '继续学习' : '开始学习'}
                  </Link>
                ) : data.nextCourse.status === 'inherited' ? (
                  <>
                    <Link className="btn btn-primary" to={`/courses/${data.nextCourse.courseId}`}>
                      <Icon name="run" size={16} /> 开始重学
                    </Link>
                    <button className="btn btn-secondary" onClick={() => skipCourse(data.nextCourse!.courseId)}>
                      <Icon name="hide" size={16} /> 跳过
                    </button>
                  </>
                ) : null}
                {data.nextCourse.status === 'locked' && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--meta)', alignSelf: 'center' }}>
                    🔒 需先完成：{data.nextCourse.missingPrerequisites.join('、')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)', color: 'var(--success)' }}>
              全部完成！可以切换学习其他路径
            </div>
          )}
        </div>
      )}

      {/* ═══ 阶段视图 ═══ */}
      {activePathData && activePathData.stages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {activePathData.stages.map((s: StageSummary, i: number) => (
            <div key={i} className="card" style={{
              opacity: s.unlocked ? 1 : 0.5,
              borderColor: s.unlocked && s.pct > 0 ? 'var(--accent-border)' : undefined,
            }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-announce-cjk)', marginBottom: 4 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginBottom: 'var(--space-2)' }}>
                {s.doneCount}/{s.courseCount} 门 · {s.pct}%
                {!s.unlocked && ' · 🔒 未解锁'}
              </div>
              <div className="progress-track" style={{ height: 4 }}>
                <div className="progress-fill" style={{ width: `${s.pct}%`, background: s.unlocked ? 'var(--accent)' : 'var(--meta)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ 课程列表 ═══ */}
      <div className="panel">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>课程进度</h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.courses.map((c: CourseState, i: number) => (
            <div key={c.courseId} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)',
              borderBottom: '1px solid var(--border-soft)',
              opacity: c.status === 'locked' || c.status === 'skipped' ? 0.45 : 1,
              background: c.status === 'doing' ? 'var(--accent-soft)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--meta)', width: 24, textAlign: 'center', flex: 'none' }}>
                {String(i + 1).padStart(2, '0')}
              </span>

              <span style={{ color: statusColor(c.status), flex: 'none' }}>{statusIcon(c.status)}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Link to={`/courses/${c.courseId}`} style={{
                    fontSize: 'var(--text-base)', fontWeight: 'var(--weight-announce-cjk)',
                    color: 'var(--fg)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.name}</Link>
                  <span className={`pill ${statusBadge(c.status)}`} style={{ fontSize: 10 }}>
                    {statusLabel(c.status)}
                  </span>
                  {c.status === 'inherited' && c.sourcePath && (
                    <span style={{ fontSize: 10, color: 'var(--meta)' }}>来自「{c.sourcePath}」</span>
                  )}
                  {c.stageName && (
                    <span className="tag">{c.stageName}</span>
                  )}
                </div>

                {/* 锁定原因 */}
                {c.status === 'locked' && c.missingPrerequisites.length > 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 2 }}>
                    需先完成：{c.missingPrerequisites.join('  →  ')}
                  </div>
                )}

                {/* 进度条 */}
                {c.status === 'doing' && c.totalChapters > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4, maxWidth: 200 }}>
                    <div className="progress-track" style={{ flex: 1, height: 4 }}>
                      <div className="progress-fill" style={{ width: `${c.percent}%` }} />
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-announce)' }}>{c.percent}%</span>
                  </div>
                )}

                {/* 章节数 */}
                {c.totalChapters > 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {c.chapterDone ?? 0}/{c.totalChapters} 章 · {c.difficulty} · {c.estimatedHours}h
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div style={{ flex: 'none', display: 'flex', gap: 'var(--space-1)' }}>
                {c.status === 'completed' ? (
                  <Link className="btn btn-sm btn-ghost" to={`/courses/${c.courseId}`}>复习</Link>
                ) : c.status === 'inherited' ? (
                  <>
                    <Link className="btn btn-sm btn-primary" to={`/courses/${c.courseId}`}>重学</Link>
                    <button className="btn btn-sm btn-ghost" onClick={() => skipCourse(c.courseId)}>跳过</button>
                  </>
                ) : c.status === 'skipped' ? (
                  <button className="btn btn-sm btn-ghost" onClick={() => unskipCourse(c.courseId)}>恢复</button>
                ) : c.status === 'doing' ? (
                  <Link className="btn btn-sm btn-primary" to={`/courses/${c.courseId}`}><Icon name="run" size={16} />继续</Link>
                ) : c.status === 'pending' ? (
                  <Link className="btn btn-sm btn-secondary" to={`/courses/${c.courseId}`}>开始</Link>
                ) : (
                  <span className="btn btn-sm" style={{ opacity: 0.4, cursor: 'not-allowed' }}>🔒</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 所有路径概览 ═══ */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>所有学习路径</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {data.paths.map(p => (
            <div key={p.pathId} className="card" style={{
              cursor: p.pathId !== activePath ? 'pointer' : 'default',
              borderColor: p.pathId === activePath ? 'var(--accent-border)' : undefined,
              boxShadow: p.pathId === activePath ? '0 0 0 1px var(--accent-soft)' : undefined,
            }} onClick={() => p.pathId !== activePath && setPreviewPathId(p.pathId)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: 2 }}>{p.name}</h3>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', margin: 0 }}>{p.description}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce)', color: 'var(--accent)', flex: 'none', marginLeft: 'var(--space-2)' }}>{p.completion}%</span>
              </div>
              <div className="progress-track" style={{ height: 6, marginTop: 'var(--space-2)' }}>
                <div className="progress-fill" style={{ width: `${p.completion}%` }} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                <span>{p.inheritedCount} 继承</span><span>{p.newCount} 新学</span>
                <span>{p.totalCount} 门课</span>
                {p.savedHours > 0 && <span>省 {p.savedHours}h</span>}
              </div>
              {p.pathId !== activePath && (
                <button className="btn btn-sm btn-secondary" style={{ marginTop: 'var(--space-2)', width: '100%' }}
                  onClick={(e) => { e.stopPropagation(); switchPath(p.pathId); }}>
                  切换到此路径
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
