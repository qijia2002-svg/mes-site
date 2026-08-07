import type { SimProject, SimState, SimFactory } from './simTypes';
import { getActiveLine } from './simReducer';
import { peek, write } from '../../lib/userData';

interface StoredShape {
  factories: SimFactory[];
  activeFactoryId: string;
  activeLineId: string;
}

export function saveToStorage(state: SimState): void {
  const data: StoredShape = {
    factories: state.factories,
    activeFactoryId: state.activeFactoryId,
    activeLineId: state.activeLineId,
  };
  void write('sim_project', data);
}

export function loadFromStorage(): StoredShape | null {
  const d = peek<StoredShape | null>('sim_project', null);
  if (d && Array.isArray(d.factories) && d.factories.length > 0) return d;
  return null;
}

/** 导出当前激活产线为单条工艺路线 JSON */
export function exportJSON(state: SimState): string {
  const line = getActiveLine(state);
  const project: SimProject = {
    name: line?.name ?? '工艺路线',
    nodes: line?.nodes ?? [],
    edges: line?.edges ?? [],
    version: 1,
  };
  return JSON.stringify(project, null, 2);
}

export function importJSON(raw: string): SimProject | null {
  try {
    const p = JSON.parse(raw) as SimProject;
    if (!p || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
    return { ...p, version: p.version || 1 };
  } catch {
    return null;
  }
}
