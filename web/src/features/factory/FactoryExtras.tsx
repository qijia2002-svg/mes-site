/**
 * 工厂页脚：默认折叠的「其它入口」。
 *
 * 横切系统（MES / ERP / WMS / QMS）从流程图里的四张大卡降级到这里——它们是工具，
 * 不是流程主干；课程 / 路径 / 岗位 / 搭建也只留一行文字链接，不跟工厂抢首屏。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { SYSTEMS } from './factoryFlow.data';

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/courses', label: '课程目录', icon: 'courses' },
  { to: '/learning-paths', label: '学习路径', icon: 'paths' },
  { to: '/roadmap', label: '岗位路线', icon: 'stage' },
  { to: '/order-to-delivery', label: '订单到交付全景', icon: 'routing' },
  { to: '/simulator', label: '工厂模拟器', icon: 'gauge' },
  { to: '/sql-space', label: 'SQL 沙盒', icon: 'sql' },
];

export default function FactoryExtras() {
  const [open, setOpen] = useState(false);

  return (
    <section className="fx">
      <style>{`
        .fx{margin-top:var(--space-12);border-top:1px solid var(--border);padding-top:var(--space-4)}
        .fx-toggle{display:inline-flex;align-items:center;gap:var(--space-2);background:none;
          border:none;padding:var(--space-1) 0;font-family:inherit;font-size:var(--text-sm);
          color:var(--muted);cursor:pointer;
          transition:color var(--motion-fast) var(--ease-standard)}
        .fx-toggle:hover{color:var(--fg)}
        .fx-caret{display:flex;color:var(--border-strong);
          transition:transform var(--motion-fast) var(--ease-standard)}
        .fx-toggle[aria-expanded="true"] .fx-caret{transform:rotate(90deg)}
        .fx-body{margin-top:var(--space-4)}
        .fx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));
          gap:var(--space-3)}
        .fx-sys{border:1px solid var(--border);border-radius:var(--radius-md);
          background:var(--surface);padding:var(--space-4)}
        .fx-sys-top{display:flex;align-items:center;gap:var(--space-3)}
        .fx-sys-ic{color:var(--muted);display:flex;flex:none}
        .fx-sys h3{margin:0;font-size:var(--text-base);font-weight:var(--weight-announce-cjk)}
        .fx-sys .role{margin:2px 0 0;font-size:var(--text-xs);color:var(--meta)}
        .fx-sys .body{margin:var(--space-3) 0 0;color:var(--fg-2);font-size:var(--text-sm);
          line-height:var(--leading-body)}
        .fx-links{display:flex;align-items:center;gap:var(--space-5);flex-wrap:wrap;
          margin-top:var(--space-5)}
        .fx-links .lbl{font-size:var(--text-xs);color:var(--meta)}
        .fx-links a{display:inline-flex;align-items:center;gap:var(--space-2);
          font-size:var(--text-sm);color:var(--muted);text-decoration:none;
          transition:color var(--motion-fast) var(--ease-standard)}
        .fx-links a:hover{color:var(--fg)}
        .fx-links a .qi{display:flex;color:var(--border-strong);
          transition:color var(--motion-fast) var(--ease-standard)}
        .fx-links a:hover .qi{color:var(--accent)}
      `}</style>

      <button type="button" className="fx-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="fx-caret"><Icon name="chevron-right" size={16} /></span>
        贯穿全流程的四套系统，以及按课表学的入口
      </button>

      {open && (
        <div className="fx-body">
          <div className="fx-grid">
            {SYSTEMS.map((s) => (
              <article key={s.id} className="fx-sys">
                <div className="fx-sys-top">
                  <span className="fx-sys-ic"><Icon name={s.icon} size={20} /></span>
                  <div>
                    <h3>{s.name}</h3>
                    <p className="role">{s.role}</p>
                  </div>
                </div>
                <p className="body">{s.body}</p>
              </article>
            ))}
          </div>
          <nav className="fx-links" aria-label="其它入口">
            <span className="lbl">想按课表学？</span>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to}>
                <span className="qi"><Icon name={l.icon} size={16} /></span>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </section>
  );
}
