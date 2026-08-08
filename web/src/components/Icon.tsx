/**
 * 全站唯一图标出口（ADR-002 / AC-08）。
 *
 * 铁律：
 *  - 全项目只用 lucide-react@1.28.0，禁 emoji 当功能图标，禁引第二个图标库。
 *  - 页面不直接 import lucide 组件，一律走这里的语义名，改图标只改这一处。
 *  - 具名导入（禁 `import * as`），保证 tree-shaking。
 *  - 尺寸只有 16 / 20 / 24 三档；strokeWidth 固定 2（design-tokens `--icon-stroke`）。
 *  - 光学补偿：16px 图标与 13-15px 文字并排时用 --muted 上色，不调 strokeWidth。
 */
import type { SVGProps } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  Blocks,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePlay,
  CircleQuestionMark,
  CircleUser,
  CircleX,
  CircuitBoard,
  ClipboardCheck,
  ClipboardList,
  ClockArrowLeft,
  Code,
  Cog,
  Columns3,
  Compass,
  Copy,
  Cpu,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  Factory,
  Flag,
  Flame,
  FileText,
  Gauge,
  GitBranch,
  HardHat,
  Inbox,
  Info,
  Key,
  LayoutDashboard,
  Languages,
  Lightbulb,
  List,
  ListChecks,
  ListRestart,
  Lock,
  LockOpen,
  ListFilter,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Maximize2,
  Minimize2,
  Menu,
  Minus,
  Milestone,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  Quote,
  RotateCcw,
  Route,
  ScanLine,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  Table2,
  Target,
  Terminal,
  Trash2,
  TriangleAlert,
  Upload,
  UserCheck,
  Warehouse,
  Workflow,
  X,
  Calendar,
  Calculator,
  Truck,
  Send,
  ShoppingCart,
} from 'lucide-react';

/** 语义名 → lucide 组件。新增图标只在这张表里加，页面永远用语义名。 */
const REGISTRY = {
  // App Shell / 导航
  dashboard: LayoutDashboard,
  courses: BookOpen,
  chapter: FileText,
  paths: Route,
  sql: Database,
  quiz: ListChecks,
  admin: Settings2,
  login: LogIn,
  logout: LogOut,
  user: CircleUser,
  search: Search,
  dictionary: Languages,
  'sidebar-close': PanelLeftClose,
  'sidebar-open': PanelLeftOpen,
  menu: Menu,
  close: X,

  // 方向
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  // 方向基元补齐：micro 练习 order 题的「上移」按钮需要，chevron-down 已在但缺 up
  'chevron-up': ChevronUp,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'sort': ArrowUpDown,

  // 状态与反馈
  success: CircleCheck,
  warn: TriangleAlert,
  error: CircleX,
  danger: CircleAlert,
  info: Info,
  help: CircleQuestionMark,
  loading: LoaderCircle,
  empty: Inbox,
  'empty-search': SearchX,

  // SQL 工作台
  run: Play,
  play: Play,
  pause: Pause,
  reset: RotateCcw,
  copy: Copy,
  download: Download,
  history: ClockArrowLeft,
  table: Table2,
  column: Columns3,
  hint: Lightbulb,

  // 正文
  toc: List,
  'external-link': ExternalLink,

  // MES 领域
  'work-order': ClipboardList,
  report: ClipboardCheck,
  dispatch: UserCheck,
  schedule: CalendarClock,
  bom: Boxes,
  material: Package,
  equipment: Cog,
  workshop: Factory,
  routing: Workflow,
  process: Milestone,
  quality: ShieldCheck,
  trace: GitBranch,
  warehouse: Warehouse,
  oee: Gauge,

  // 能力路线（/roadmap · /tracks/:slug）——UIUX-CareerRoadmap-v1 §6.2
  // sql 已存在（Database），复用不重复登记；mes 用 Blocks 而非 Factory（workshop 已占 Factory）
  erp: Building2,
  mes: Blocks,
  plc: Cpu,
  embedded: CircuitBoard,
  network: Network,
  linux: Terminal,
  barcode: ScanLine,

  // 岗位与成长阶段（/roadmap）——UIUX-CareerRoadmap-v1 §6.3
  // 二开岗用 Code：lucide-react@1.28.0 无 Code2，写了直接构建失败
  'role-mes-impl': HardHat,
  'role-erp-consultant': Briefcase,
  'role-mes-dev': Code,
  'role-scada': Activity,
  'role-owner-digital': Compass,
  stage: Target,

  // 后台 / 表格
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  portfolio: Briefcase,
  confirm: Check,
  filter: ListFilter,
  more: Ellipsis,
  show: Eye,
  hide: EyeOff,
  upload: Upload,
  expand: Maximize2,
  minimize: Minimize2,
  minus: Minus,
  plus: Plus,

  // 首页
  streak: Flame,

  // UIX-Redesign v1
  lock: Lock,

  // 零基础重学重构 v1（SPEC §5 / UIUX §5.2）——9 个语义名，全部核验存在于 lucide-react@1.28.0
  // 命名口径：对照块叫 mapping 不叫 analogy（ADR-021 已删 analogy 槽位：讲系统，不打生活比方）
  unlock: LockOpen,            // 站点解锁瞬间，与 lock 成对交换
  mapping: ArrowLeftRight,     // 车间真实动作 ↔ 系统真实记录 对照
  example: Quote,              // 真实数据例子块（WO-20260801-02 计划60/完成40）
  'you-are-here': MapPin,      // 主线当前站标记
  station: Flag,               // 主线站点标记（process 已占 Milestone，此处用 Flag 不冲突）
  start: CirclePlay,           // 「从这里开始」主 CTA
  'deep-dive': ChevronsDown,   // 「想深入」折叠块触发器
  recap: ListRestart,          // 本站小结 / 回顾
  answer: Key,                 // 提示第 3 级「直接看答案」

  // 工厂流程图节点图标（factory-first；复用已导入的 lucide 组件，不与既有语义名冲突）
  'shopping-cart': ShoppingCart,
  'clipboard-check': ClipboardCheck,
  calendar: Calendar,
  calculator: Calculator,
  truck: Truck,
  'git-branch': GitBranch,
  package: Package,
  send: Send,
  factory: Factory,
  'check-circle': CircleCheck,
  'log-out': LogOut,
} as const;

export type IconName = keyof typeof REGISTRY;

/**
 * 运行时校验语义名。后端返回的 icon 字段是字符串，进 <Icon> 前必须过这一关，
 * 未注册的名字退化成 `paths`（Route），**绝不 fallback 成 emoji**（API 契约 §0.6）。
 */
export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

/** 三档尺寸：16 行内 · 20 按钮/导航 · 24 独立图标。 */
export type IconSize = 16 | 20 | 24;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName;
  size?: IconSize;
  /** 装饰性图标默认 aria-hidden；传 label 则作为可读图标暴露给读屏。 */
  label?: string;
}

export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  const Glyph = REGISTRY[name];
  // 兜底守卫：未注册的语义名绝不渲染 undefined（否则 React #130 整页崩溃）。
  // 开发环境打印告警便于早发现，生产环境静默降级为无图标，不阻断页面。
  if (!Glyph) {
    if (import.meta.env?.DEV) console.warn(`[Icon] 未注册的图标名：${String(name)}`);
    return null;
  }
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={2}
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    />
  );
}

/** 加载态专用：自带旋转，reduced-motion 下由 CSS 停转。 */
export function SpinnerIcon({ size = 16, label = '加载中' }: { size?: IconSize; label?: string }) {
  return <Icon name="loading" size={size} label={label} className="spin" />;
}
