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
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  CircleUser,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  ClockArrowLeft,
  Cog,
  Columns3,
  Copy,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  Factory,
  FileText,
  Gauge,
  GitBranch,
  Inbox,
  Info,
  LayoutDashboard,
  Lightbulb,
  List,
  ListChecks,
  ListFilter,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Milestone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  Table2,
  Trash2,
  TriangleAlert,
  Upload,
  UserCheck,
  Warehouse,
  Workflow,
  X,
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
  'sidebar-close': PanelLeftClose,
  'sidebar-open': PanelLeftOpen,
  menu: Menu,
  close: X,

  // 方向
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
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

  // 后台 / 表格
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  confirm: Check,
  filter: ListFilter,
  more: Ellipsis,
  show: Eye,
  hide: EyeOff,
  upload: Upload,
} as const;

export type IconName = keyof typeof REGISTRY;

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
