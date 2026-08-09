/**
 * 两岛打通序列化器：把一次仿真的结构化明细（report）转成建表 + 插入 SQL。
 *
 * 设计铁律：
 *  - 只生成 `sim_*` 命名空间表，绝不触碰 canonical 的 work_orders / production_records /
 *    quality_checks —— 那些是哈希判题唯一事实源（dataset.sql），改一字都会废题。
 *  - 输出作为「附加 SQL」拼到 SANDBOX_DATASET_SQL 后面重建库，canonical 库原样保留。
 *  - 纯函数、无副作用、不依赖运行环境；SQL 字面量做单引号转义。
 */
import type { SimRunReport } from './simEngine';

/** 单引号转义（SQLite 文本字面量规则：' → ''） */
function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** 把一行记录转成 VALUES 元组（字段顺序与建表一致） */
function row(cols: string[]): string {
  return `(${cols.join(', ')})`;
}

/**
 * 生成可直接交给 sql.js 执行的 SQL 字符串：
 * 3 张 sim_* 表 + 对应 INSERT。工单号/时间戳来自 report，保证每次运行可区分。
 */
export function toSimSql(report: SimRunReport): string {
  const out: string[] = [];
  out.push('-- 仿真产线导出（两岛打通）：由仿真沙盒运行生成，命名空间 sim_*，不污染示例库');
  out.push('-- 在 SQL 工作台「我的产线数据」模式下随样例库一起加载');

  // 工单
  out.push(
    'CREATE TABLE sim_work_orders (' +
      'wo_no TEXT, product TEXT, qty_plan INTEGER, qty_done INTEGER, ' +
      'state TEXT, workshop TEXT, due_date TEXT);',
  );
  const w = report.workOrder;
  if (w.woNo) {
    out.push(
      'INSERT INTO sim_work_orders VALUES ' +
        row([
          `'${esc(w.woNo)}'`,
          `'${esc(w.product)}'`,
          String(w.qtyPlan),
          String(w.qtyDone),
          `'${esc(w.state)}'`,
          `'${esc(w.workshop)}'`,
          `'${esc(w.dueDate)}'`,
        ]) +
        ';',
    );
  }

  // 报工
  out.push(
    'CREATE TABLE sim_production_records (' +
      'rec_id INTEGER, node_label TEXT, equip_code TEXT, operator TEXT, ' +
      'qty_ok INTEGER, qty_ng INTEGER, report_time TEXT);',
  );
  if (report.production.length) {
    const vals = report.production
      .map((p) =>
        row([
          String(p.recId),
          `'${esc(p.nodeLabel)}'`,
          `'${esc(p.equipCode)}'`,
          `'${esc(p.operator)}'`,
          String(p.qtyOk),
          String(p.qtyNg),
          `'${esc(p.reportTime)}'`,
        ]),
      )
      .join(', ');
    out.push(`INSERT INTO sim_production_records VALUES ${vals};`);
  }

  // 质检
  out.push(
    'CREATE TABLE sim_quality_checks (' +
      'check_id INTEGER, node_label TEXT, check_time TEXT, result TEXT, defect_type TEXT);',
  );
  if (report.checks.length) {
    const vals = report.checks
      .map((c) =>
        row([
          String(c.checkId),
          `'${esc(c.nodeLabel)}'`,
          `'${esc(c.checkTime)}'`,
          `'${esc(c.result)}'`,
          c.defectType ? `'${esc(c.defectType)}'` : 'NULL',
        ]),
      )
      .join(', ');
    out.push(`INSERT INTO sim_quality_checks VALUES ${vals};`);
  }

  return out.join('\n');
}
