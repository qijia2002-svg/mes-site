/**
 * 学习中心：按知识领域分组展示所有课程模块。
 * 分组：ERP / MES / SQL / PLC / 实操题 / 求职路线图
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type Topic } from '../api/endpoints';

interface Group {
  label: string;
  desc: string;
  icon: string;
  match: (t: Topic) => boolean;
}

const GROUPS: Group[] = [
  { label: 'ERP 原理与模块', desc: '从销售订单到财务结算的企业经营全貌', icon: 'report', match: (t) => t.id === 4 },
  { label: 'MES 核心模块', desc: '工单/物料/报工/质量/追溯/设备/看板', icon: 'workshop', match: (t) => t.id === 5 },
  { label: 'SQL 查询基础', desc: 'SELECT / WHERE / GROUP BY / JOIN', icon: 'sql', match: (t) => t.id === 6 },
  { label: 'PLC 可编程逻辑控制器', desc: '基础/梯形图/工业控制/SCADA-MES集成', icon: 'equipment', match: (t) => t.id === 7 },
  { label: '实操题', desc: '工单/BOM/报工 — 配 SQL 判题 + 选择题', icon: 'table', match: (t) => [1, 2, 3].includes(t.id) },
  { label: '求职路线图', desc: '实施工程师 / 30天冲刺 / 25天SCADA冲刺', icon: 'paths', match: (t) => t.id >= 5000 },
];

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">学习中心</h1>
          <p className="page-sub">
            ERP / MES / SQL / PLC 理论章节 + 实操判题 + 求职路线图。按模块分组，选一个开始。
          </p>
        </div>
        {topics.data && <span className="row-meta">共 {topics.data.length} 门</span>}
      </header>

      {topics.isLoading && <LoadingState label="正在加载课程…" />}
      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
      {topics.data?.length === 0 && (
        <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
      )}

      {topics.data && topics.data.length > 0 && (
        <>
          {GROUPS.map((group) => {
            const items = topics.data!.filter(group.match);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="section">
                <div className="section-head">
                  <h2 className="section-title">{group.label}</h2>
                  <span className="row-meta">{group.desc}</span>
                </div>
                <ul className="card-grid">
                  {items.map((t) => (
                    <li key={t.id}>
                      <Link className="card" to={`/courses/${t.id}`}>
                        <h3 className="card-title">{t.title}</h3>
                        <p className="card-desc">{t.description || '暂无课程简介。'}</p>
                        <div className="tag-row">
                          {t.modules.map((m) => (
                            <span key={m} className="tag">
                              {m}
                            </span>
                          ))}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
