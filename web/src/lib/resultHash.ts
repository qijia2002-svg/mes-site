/**
 * SQL 判题：结果集归一化 + SHA-256（F3 / AC-03）。
 *
 * [契约] 本算法与后端 seed 计算 answer_hash 的脚本**必须逐字一致**，
 * 改任何一行都要同步改另一侧，否则全站判题静默失效（最危险的失效模式：
 * 不报错，只是所有人都判错）。
 *
 * 归一化定义（唯一版本，team-lead 2026-07-31 最终裁定）：
 *   1. 取执行结果**最后一个**结果集的 values（二维数组）。
 *   2. 列按 SQL 返回顺序，**不含列名**——只取值。列别名不影响判题。
 *   3. 每行：JSON.stringify(row.map(v => v ?? null))
 *      → null / undefined 归一为 null；number 走 JSON 默认序列化；
 *        string 原样（含引号转义）；boolean → true/false。
 *   4. **不排序**，保持 SQL 输出序 —— 因此 ORDER BY 是被考查的能力点。
 *      前提：两端都用 sql.js 1.13.0（同一 WASM 二进制）+ 同一份 dataset.sql，
 *      返回序确定（ADR-005）。
 *   5. '\n' 连接成 canonical 字符串。
 *   6. UTF-8 编码后 SHA-256，输出小写 hex。
 *
 * 空结果集 → canonical 为空串 → e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */

export type Cell = unknown;

/**
 * 拍平成 canonical 字符串。
 * 导出是为了排障时能把两端的 canonical 直接肉眼 diff ——
 * 哈希对不上时，比对 canonical 比比对 hex 快一个数量级。
 */
export function canonicalizeRows(rows: Cell[][]): string {
  return rows.map((row) => JSON.stringify(row.map((v) => v ?? null))).join('\n');
}

/** 判题哈希：canonical → SHA-256 小写 hex。 */
export async function hashResultSet(rows: Cell[][]): Promise<string> {
  return sha256Hex(canonicalizeRows(rows));
}

export async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // 非安全上下文（http 裸 IP 访问）拿不到 WebCrypto。
    // 必须显式抛错而不是静默判错——静默判错会让学员以为是自己 SQL 写错了。
    throw new Error('当前环境不支持 Web Crypto，判题不可用。请通过 https 或 localhost 访问。');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
