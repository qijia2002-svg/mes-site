/**
 * 后端 icon 字符串 → `Icon.tsx` REGISTRY 语义名的归一层。
 *
 * 为什么需要这一层（UIUX §6.4：slug→语义名映射不进 REGISTRY）：
 *  1. 数据源与 API 文档对同一图标有两种写法（`role-mes-impl` / `career-mes-impl`），
 *     注册表里挂别名会让同一个字形有多个入口，越滚越大；别名收在 feature 内。
 *  2. 种子数据里还有 `clipboard-list` / `code` 两个键未登记（PRD §166 已记为缺陷），
 *     这里映射到语义等价的既有字形，避免路线图上出现空图标。
 *  3. 兜底绝不能是 emoji —— 三层查不到就退化成 `paths`（Route）。
 */
import { isIconName, type IconName } from '../../components/Icon';

/** 后端写法 → 已注册语义名。左侧是**未注册**的字符串，右侧必须是 REGISTRY 里的键。 */
const ALIAS: Record<string, IconName> = {
  'career-mes-impl': 'role-mes-impl',
  'career-erp-consultant': 'role-erp-consultant',
  'career-mes-dev': 'role-mes-dev',
  'career-scada': 'role-scada',
  'career-owner-digital': 'role-owner-digital',
  // 种子数据里的两条新路线：语义等价替代，不新增字形
  'clipboard-list': 'work-order',
  code: 'role-mes-dev',
  'workflow': 'routing',
  factory: 'workshop',
};

/** icon 字段缺失时按 slug 兜底（正常链路走不到，脏数据时保证图标不空）。 */
const TRACK_BY_SLUG: Record<string, IconName> = {
  erp: 'erp',
  mes: 'mes',
  sql: 'sql',
  plc: 'plc',
  embedded: 'embedded',
  network: 'network',
  linux: 'linux',
  barcode: 'barcode',
};

const CAREER_BY_SLUG: Record<string, IconName> = {
  'mes-implementation': 'role-mes-impl',
  'erp-consultant': 'role-erp-consultant',
  'mes-development': 'role-mes-dev',
  'scada-engineer': 'role-scada',
  'owner-digital': 'role-owner-digital',
};

function resolve(
  raw: string | undefined,
  slug: string,
  bySlug: Record<string, IconName>,
  fallback: IconName,
): IconName {
  if (raw && isIconName(raw)) return raw;
  if (raw && ALIAS[raw]) return ALIAS[raw];
  return bySlug[slug] ?? fallback;
}

/** 能力路线图标：节点 / 列头 20px，详情页头 24px，行内 16px。 */
export function trackIcon(slug: string, raw?: string): IconName {
  return resolve(raw, slug, TRACK_BY_SLUG, 'paths');
}

/** 岗位图标：选择器 chip 与岗位画像。 */
export function careerIcon(slug: string, raw?: string): IconName {
  return resolve(raw, slug, CAREER_BY_SLUG, 'user');
}

/** 成长阶段图标：graph 的 stage 节点自带 icon，未登记时统一落到 `stage`(Target)。 */
export function stageIcon(raw?: string): IconName {
  if (raw && isIconName(raw)) return raw;
  if (raw && ALIAS[raw]) return ALIAS[raw];
  return 'stage';
}
