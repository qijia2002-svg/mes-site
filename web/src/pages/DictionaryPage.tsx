/**
 * 名称翻译页（学习中心入口，原「英文词典」改名）。
 * 承载 WordExplainer：点选 / 输入专业英文名称，查看词性、中文翻译、释义与发音。
 * 支持 ?q= 深链：从首页等入口带词直达即自动翻译。
 * 遵循 P0：图标走 Icon 体系、配色用 token、零 emoji。
 */
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import WordExplainer from '../components/WordExplainer';

export default function DictionaryPage() {
  const [sp] = useSearchParams();
  const q = sp.get('q');

  return (
    <section style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h1
          className="page-title"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-announce-cjk)' }}
        >
          <Icon name="dictionary" size={24} /> 名称翻译
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
          点选或输入数据库 / SQL / 编程 / MES 相关的英文名称，查看词性、中文翻译、释义与发音。下方词汇表点选即可翻译。
        </p>
      </div>
      <WordExplainer initialWord={q ?? undefined} />
    </section>
  );
}
