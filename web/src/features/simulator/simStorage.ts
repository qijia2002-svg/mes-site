import type { SimProject, SimState } from './simTypes';

const LS_KEY = 'mes.sim_project';

export function saveToStorage(state: SimState): void {
  const project: SimProject = {
    name: state.projectName,
    nodes: state.nodes,
    edges: state.edges,
    version: 1,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(project));
  } catch {
    // 存储不可用不影响功能
  }
}

export function loadFromStorage(): SimProject | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SimProject;
    if (p && Array.isArray(p.nodes) && Array.isArray(p.edges)) return p;
    return null;
  } catch {
    return null;
  }
}

export function exportJSON(state: SimState): string {
  const project: SimProject = {
    name: state.projectName,
    nodes: state.nodes,
    edges: state.edges,
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
