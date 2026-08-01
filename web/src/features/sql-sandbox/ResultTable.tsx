/**
 * 结果集表格。超过 200 行只渲染前 200 行——练习题不需要全量渲染，
 * 一条 SELECT * FROM 大表就能把主线程钉死。
 */
import { Icon } from '../../components/Icon';

const RENDER_LIMIT = 200;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Uint8Array) return `BLOB(${value.length}B)`;
  return String(value);
}

export function ResultTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  if (columns.length === 0) return null;

  const visible = rows.slice(0, RENDER_LIMIT);
  const truncated = rows.length - visible.length;

  return (
    <div className="result-wrap" role="region" aria-label="查询结果" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={`${c}-${i}`} scope="col">
                <Icon name="column" size={16} className="th-glyph" />
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={cell === null ? 'is-null' : undefined}>
                  {cellText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated > 0 && (
        <p className="result-truncated">
          仅显示前 {RENDER_LIMIT} 行，另有 {truncated} 行未渲染（判题仍按完整结果集计算）
        </p>
      )}
    </div>
  );
}
