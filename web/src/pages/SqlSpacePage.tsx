/**
 * SQL 工作台 · 自由练习。
 * 不带题目 = 不判题，随便写；要判题走 /sql-space/:exerciseId。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SqlSandbox } from '../features/sql-sandbox/SqlSandbox';

export default function SqlSpacePage() {
  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">SQL 工作台</h1>
          <p className="page-sub">
            一套精简 MES 样例库（产品 / 物料 / BOM / 设备 / 工单 / 生产记录 / 质检）跑在浏览器的
            SQLite（WASM）里。增删改查都能练，写坏了点「重置样例库」就回到初始状态。
          </p>
        </div>
        <Link className="btn btn-secondary" to="/quiz">
          <Icon name="quiz" size={16} />
          找题来判
        </Link>
      </header>

      <div className="sandbox-guide">
        <span className="sandbox-guide-step"><span className="sandbox-guide-num">1</span> 在「挑一个场景练手」里选一题</span>
        <span className="sandbox-guide-step"><span className="sandbox-guide-num">2</span> 点「载入模板」，SQL 会出现在编辑器</span>
        <span className="sandbox-guide-step"><span className="sandbox-guide-num">3</span> 在 TODO 处补全，按 运行（Ctrl/⌘ + ↵）</span>
        <span className="sandbox-guide-step"><span className="sandbox-guide-num">4</span> 看结果，点「看预期」对照思路</span>
      </div>

      <SqlSandbox />
    </section>
  );
}
