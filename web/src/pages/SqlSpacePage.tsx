import { SqlSandbox } from '../features/sql-sandbox/SqlSandbox';

export default function SqlSpacePage() {
  return (
    <section>
      <h2>SQL 在线练习沙箱</h2>
      <p className="hint">
        在浏览器内运行 SQLite（sql.js WASM），无需后端、可离线、可练完整写操作。
      </p>
      <SqlSandbox />
    </section>
  );
}
