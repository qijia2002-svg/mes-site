/**
 * 英文词典页（学习中心「工具」分组入口）。
 * 承载 WordExplainer：查 SQL / 数据库 / 编程相关英文单词的翻译、释义与发音。
 * 遵循 P0：图标走 Icon 体系、配色用 token、零 emoji。
 */
import { Icon } from '../components/Icon';
import WordExplainer from '../components/WordExplainer';

export default function DictionaryPage() {
  return (
    <section style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h1
          className="page-title"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-announce-cjk)' }}
        >
          <Icon name="dictionary" size={24} /> 英文词典
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
          输入数据库 / SQL / 编程相关的英文单词，查看词性、中文释义、例句与发音。点击上方关键字可快速体验。
        </p>
      </div>
      <WordExplainer />
    </section>
  );
}
