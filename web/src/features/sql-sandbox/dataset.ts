// 沙箱样例库：单一事实源是同目录 dataset.sql，此处只做 ?raw 引入，绝不另抄一份。
// 后端 seed 计算 answer_hash 时必须读取同一个 dataset.sql 建库。
import datasetSql from './dataset.sql?raw';

export const SANDBOX_DATASET_SQL: string = datasetSql;

/** 沙箱内可用的表，用于结构提示与重置。 */
export const SANDBOX_TABLES = [
  'products',
  'materials',
  'bom',
  'equipment',
  'work_orders',
  'production_records',
  'quality_checks',
] as const;

/** 未绑定题目时的默认演示查询。 */
export const SANDBOX_SAMPLE_QUERY = `SELECT p.name AS 产品, SUM(w.qty_plan) AS 计划总量
FROM work_orders w
JOIN products p ON w.product_id = p.product_id
GROUP BY p.product_id
ORDER BY 计划总量 DESC;`;
