/**
 * 模块注册表（§A5.2）：决定"主题能开哪些模块"。
 * 新增主题只落数据（topics.modules JSON），后端零代码改动。
 * 未在注册表中的 key 一律丢弃，防止脏数据让前端崩溃。
 */
export const MODULE_REGISTRY = {
  theory: { table: 'chapters', cacheTtl: 300, public: true },
  quiz: { table: 'questions', cacheTtl: 120, public: true },
  sql: { table: 'sql_exercises', cacheTtl: 300, public: true },
  simulation: {
    table: 'fault_scenarios',
    cacheTtl: 300,
    public: true,
    variants: ['factory', 'blocks'] as const,
  },
} as const;

export type ModuleKey = keyof typeof MODULE_REGISTRY;

/** 校验 topics.modules 中的 key 是否合法，丢弃未知项。 */
export function sanitizeModules(raw: unknown): ModuleKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (k): k is ModuleKey => typeof k === 'string' && k in MODULE_REGISTRY,
  );
}
