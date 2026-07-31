/**
 * `::: demo` config 白名单校验（§A5.3）。
 * 声明式 schema + 极简校验器（不引入 zod，避免包体与 CPU 开销）。
 * 校验时机：**写入时校验（发布接口）**，而非读取时——读接口是热路径，校验成本须前置。
 * 未知键**静默丢弃**并记 warn 日志，不报错（否则一个手滑的多余参数会让整篇无法发布）。
 */

type Field =
  | { t: 'enum'; values: readonly string[]; required?: boolean }
  | { t: 'int'; min: number; max: number; required?: boolean }
  | { t: 'bool'; required?: boolean }
  | { t: 'id'; required?: boolean }; // 仅 [A-Za-z0-9_-]{1,32}

export type DemoConfig = Record<string, unknown>;

export const DEMO_SCHEMAS = {
  factory: {
    scenarioId: { t: 'id', required: true },
    theme: { t: 'enum', values: ['day', 'night', 'auto'] },
    perspective: { t: 'bool' },
  },
  sql: {
    exerciseId: { t: 'id', required: true },
    showHint: { t: 'bool' },
  },
  blocks: {
    solutionId: { t: 'id', required: true },
    maxSteps: { t: 'int', min: 1, max: 20 },
  },
} satisfies Record<string, Record<string, Field>>;

type SchemaKey = keyof typeof DEMO_SCHEMAS;

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** 按 schema 校验并静默丢弃未知/非法字段。返回清洗后的 config。 */
export function validateDemoConfig(kind: string, input: DemoConfig): DemoConfig {
  const schema = (DEMO_SCHEMAS as Record<string, Record<string, Field>>)[kind];
  if (!schema) return {}; // 未知容器类型：返回空，不报错
  const out: DemoConfig = {};
  for (const [key, field] of Object.entries(schema)) {
    const val = input[key];
    if (val === undefined || val === null) {
      if (field.required) out[key] = defaultFor(field); // 缺必填项给默认，不报错
      continue;
    }
    if (isValid(field, val)) out[key] = val;
    // 非法值：静默丢弃
  }
  return out;
}

function isValid(field: Field, val: unknown): boolean {
  switch (field.t) {
    case 'enum':
      return typeof val === 'string' && field.values.includes(val);
    case 'int':
      return typeof val === 'number' && Number.isInteger(val) && val >= field.min && val <= field.max;
    case 'bool':
      return typeof val === 'boolean';
    case 'id':
      return typeof val === 'string' && ID_RE.test(val);
  }
}

function defaultFor(field: Field): unknown {
  switch (field.t) {
    case 'enum':
      return field.values[0];
    case 'int':
      return field.min;
    case 'bool':
      return false;
    case 'id':
      return '';
  }
}

export function isKnownDemoKind(kind: string): kind is SchemaKey {
  return kind in DEMO_SCHEMAS;
}
