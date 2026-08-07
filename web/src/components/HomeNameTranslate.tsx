/**
 * 首页名称翻译摘要区：把「名称翻译」沉淀到首页（与作品集互换位置），
 * 展示几个常用专业词 + 去翻译入口。点词深链到 /dictionary?q= 直达翻译。
 */
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

const FEATURED = ['SELECT', 'JOIN', 'TRANSACTION', 'BOM', 'ROUTING', 'OEE'];

export default function HomeNameTranslate() {
  return (
    <section className="home-nametrans">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)', margin: 0 }}>
          <Icon name="dictionary" size={20} style={{ color: 'var(--accent)' }} /> 名称翻译
        </h2>
        <Link className="text-link" to="/dictionary" style={{ fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          去翻译 <Icon name="chevron-right" size={16} />
        </Link>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--meta)', marginBottom: 'var(--space-3)' }}>
        点选专业英文名称，查看中文翻译、词性与释义。
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {FEATURED.map((w) => (
          <Link
            key={w}
            to={`/dictionary?q=${encodeURIComponent(w)}`}
            style={{
              padding: '4px var(--space-3)', borderRadius: 999, border: '1px solid var(--border-soft)',
              background: 'var(--surface)', color: 'var(--accent)', fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)', textDecoration: 'none',
            }}
          >
            {w}
          </Link>
        ))}
      </div>
    </section>
  );
}
