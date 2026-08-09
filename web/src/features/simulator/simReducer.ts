import type { SimState, SimAction, SimNode, SimEdge, SimProject, SimLine, SimFactory } from './simTypes';
import { NODE_LIBRARY, SHAPE_SIZE } from './simTypes';

let _id = 1;
function uid(): string { return `n${_id++}`; }
function eid(): string { return `e${_id++}`; }
function fid(): string { return `f${_id++}`; }
function lid(): string { return `l${_id++}`; }

export function createNode(nodeType: string, x: number, y: number): SimNode | null {
  const def = NODE_LIBRARY[nodeType];
  if (!def) return null;
  const size = SHAPE_SIZE[def.shape];
  return {
    id: uid(), nodeType, label: def.label,
    x: x - size.w / 2, y: y - size.h / 2,
    w: size.w, h: size.h, props: {},
    def: def.custom ? def : undefined, // 仅自定义工序把定义带在节点上，刷新后仍可见
  };
}

export function createEdge(from: string, to: string): SimEdge {
  return { id: eid(), from, to, dashed: false };
}

/** 取当前激活产线（单一数据源），找不到返回 null。 */
export function getActiveLine(state: SimState): SimLine | null {
  const f = state.factories.find((x) => x.id === state.activeFactoryId);
  return f?.lines.find((l) => l.id === state.activeLineId) ?? null;
}

/** 在激活产线上做不可变更新 */
function updateActiveLine(state: SimState, updater: (line: SimLine) => SimLine): SimState {
  return {
    ...state,
    factories: state.factories.map((f) =>
      f.id === state.activeFactoryId
        ? { ...f, lines: f.lines.map((l) => (l.id === state.activeLineId ? updater(l) : l)) }
        : f,
    ),
  };
}

function emptyLine(name = '产线 1'): SimLine {
  return { id: lid(), name, nodes: [], edges: [] };
}

export function initialSimState(): SimState {
  const f: SimFactory = { id: fid(), name: '工厂 A', lines: [emptyLine('产线 1')] };
  return {
    factories: [f],
    activeFactoryId: f.id,
    activeLineId: f.lines[0].id,
    selectedId: null,
    selectedEdgeId: null,
    connectingFrom: null,
    connectingPort: null,
  };
}

export function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'ADD_NODE':
      return updateActiveLine(state, (l) => ({ ...l, nodes: [...l.nodes, action.node] }));
    case 'MOVE_NODE':
      return updateActiveLine(state, (l) => ({
        ...l,
        nodes: l.nodes.map((n) => (n.id === action.id ? { ...n, x: action.x, y: action.y } : n)),
      }));
    case 'UPDATE_PROPS':
      return updateActiveLine(state, (l) => ({
        ...l,
        nodes: l.nodes.map((n) => (n.id === action.id ? { ...n, props: { ...n.props, ...action.props } } : n)),
      }));
    case 'UPDATE_LABEL':
      return updateActiveLine(state, (l) => ({
        ...l,
        nodes: l.nodes.map((n) => (n.id === action.id ? { ...n, label: action.label } : n)),
      }));
    case 'DELETE_NODE':
      return updateActiveLine(state, (l) => ({
        ...l,
        nodes: l.nodes.filter((n) => n.id !== action.id),
        edges: l.edges.filter((e) => e.from !== action.id && e.to !== action.id),
      }));
    case 'ADD_EDGE':
      return updateActiveLine(state, (l) => ({
        ...l,
        edges: [...l.edges, { ...action.edge, dashed: state.connectingPort === 'out2' }],
      }));
    case 'UPDATE_EDGE':
      return updateActiveLine(state, (l) => ({
        ...l,
        edges: l.edges.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      }));
    case 'DELETE_EDGE':
      return {
        ...updateActiveLine(state, (l) => ({ ...l, edges: l.edges.filter((e) => e.id !== action.id) })),
        selectedEdgeId: null,
      };
    case 'TOGGLE_EDGE':
      return updateActiveLine(state, (l) => ({
        ...l,
        edges: l.edges.map((e) => (e.id === action.id ? { ...e, dashed: !e.dashed } : e)),
      }));
    case 'SELECT':
      return { ...state, selectedId: action.id, selectedEdgeId: null, connectingFrom: null, connectingPort: null };
    case 'SELECT_EDGE':
      return { ...state, selectedEdgeId: action.id, selectedId: null, connectingFrom: null, connectingPort: null };
    case 'START_CONNECT':
      return { ...state, connectingFrom: action.fromId, connectingPort: action.port, selectedId: null };
    case 'CANCEL_CONNECT':
      return { ...state, connectingFrom: null, connectingPort: null };
    case 'LOAD_PROJECT':
      return updateActiveLine(state, (l) => ({
        ...l,
        name: action.project.name || l.name,
        nodes: action.project.nodes,
        edges: action.project.edges,
      }));
    case 'CLEAR':
      return updateActiveLine(state, (l) => ({ ...l, nodes: [], edges: [], name: l.name }));
    case 'LOAD_STATE':
      // 重置本环节：整体替换为一份新的通用工厂状态（沙盒不保留用户自由搭建的脏数据）。
      return action.state;
    case 'ADD_FACTORY':
      return (() => {
        const factory: SimFactory = { id: fid(), name: action.name || '新工厂', lines: [emptyLine()] };
        return {
          ...state,
          factories: [...state.factories, factory],
          activeFactoryId: factory.id,
          activeLineId: factory.lines[0].id,
          selectedId: null,
          connectingFrom: null,
          connectingPort: null,
        };
      })();
    case 'RENAME_FACTORY':
      return {
        ...state,
        factories: state.factories.map((f) => (f.id === action.id ? { ...f, name: action.name || f.name } : f)),
      };
    case 'DELETE_FACTORY':
      if (state.factories.length <= 1) return state; // 至少保留一个工厂
      {
        const rest = state.factories.filter((f) => f.id !== action.id);
        const nextActive = rest[0];
        return {
          ...state,
          factories: rest,
          activeFactoryId: nextActive.id,
          activeLineId: nextActive.lines[0].id,
          selectedId: null,
          connectingFrom: null,
          connectingPort: null,
        };
      }
    case 'ADD_LINE':
      return (() => {
        const line = emptyLine(action.name || '新产线');
        return {
          ...state,
          factories: state.factories.map((f) =>
            f.id === action.factoryId ? { ...f, lines: [...f.lines, line] } : f,
          ),
          activeFactoryId: action.factoryId,
          activeLineId: line.id,
          selectedId: null,
          connectingFrom: null,
          connectingPort: null,
        };
      })();
    case 'RENAME_LINE':
      return {
        ...state,
        factories: state.factories.map((f) => ({
          ...f,
          lines: f.lines.map((l) => (l.id === action.id ? { ...l, name: action.name || l.name } : l)),
        })),
      };
    case 'DELETE_LINE':
      {
        const factory = state.factories.find((f) => f.lines.some((l) => l.id === action.id));
        if (!factory || factory.lines.length <= 1) return state; // 每厂至少保留一条产线
        const restLines = factory.lines.filter((l) => l.id !== action.id);
        const factories = state.factories.map((f) =>
          f.id === factory.id ? { ...f, lines: restLines } : f,
        );
        const isActive = state.activeLineId === action.id;
        return {
          ...state,
          factories,
          activeFactoryId: isActive ? factory.id : state.activeFactoryId,
          activeLineId: isActive ? restLines[0].id : state.activeLineId,
          selectedId: null,
          connectingFrom: null,
          connectingPort: null,
        };
      }
    case 'SWITCH_LINE':
      return {
        ...state,
        activeFactoryId: action.factoryId,
        activeLineId: action.lineId,
        selectedId: null,
        connectingFrom: null,
        connectingPort: null,
      };
    case 'AUTO_LAYOUT':
      return updateActiveLine(state, (l) => {
        const { nodes, edges } = l;
        const indeg = new Map(nodes.map((n) => [n.id, 0]));
        edges.forEach((e) => {
          if (!e.dashed && indeg.has(e.to)) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
        });
        const adj = new Map<string, string[]>();
        nodes.forEach((n) => adj.set(n.id, []));
        edges.forEach((e) => {
          if (!e.dashed && adj.has(e.from)) adj.get(e.from)!.push(e.to);
        });
        const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
        const q = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
        const seen = new Set(q);
        while (q.length) {
          const id = q.shift()!;
          const d = depth.get(id) ?? 0;
          for (const nx of adj.get(id) ?? []) {
            depth.set(nx, Math.max(depth.get(nx) ?? 0, d + 1));
            if (!seen.has(nx)) {
              seen.add(nx);
              q.push(nx);
            }
          }
        }
        const byDepth = new Map<number, string[]>();
        nodes.forEach((n) => {
          const d = depth.get(n.id) ?? 0;
          if (!byDepth.has(d)) byDepth.set(d, []);
          byDepth.get(d)!.push(n.id);
        });
        const newNodes = nodes.map((n) => {
          const d = depth.get(n.id) ?? 0;
          const idx = byDepth.get(d)!.indexOf(n.id);
          const def = n.def ?? NODE_LIBRARY[n.nodeType];
          const s = SHAPE_SIZE[def?.shape ?? 'rect'];
          return { ...n, x: 40 + d * 190, y: 40 + idx * 120, w: s.w, h: s.h };
        });
        return { ...l, nodes: newNodes };
      });
    default:
      return state;
  }
}
