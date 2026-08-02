/**
 * 车间仿真沙盒 · 三栏布局：任务指引 | 画布 | 运行日志
 * 支持「运行仿真」：工单沿工艺路线流转，实时日志 + 指标。
 */
import { useReducer, useState, useCallback, useRef } from 'react';
import { simReducer, initialSimState } from './simReducer';
import { loadFromStorage } from './simStorage';
import { planSimulation, computeStep, startLog, DEFAULT_BATCH, type SimMetrics, type SimLogEntry } from './simEngine';
import SimToolbar from './SimToolbar';
import SimTasks from './SimTasks';
import SimCanvas from './SimCanvas';
import SimProps from './SimProps';
import SimLog from './SimLog';
import type { SimRunState } from './simTypes';
import './SimulatorPage.css';

const STEP_DELAY = 650; // 每个工序的动画间隔(ms)

const EMPTY_RUN: SimRunState = { active: false, activeNodeId: null, logs: [], metrics: null, progress: 0 };

export default function SimulatorPage() {
  const [state, dispatch] = useReducer(simReducer, null, () => {
    const saved = loadFromStorage();
    if (saved) {
      const s = initialSimState();
      return { ...s, projectName: saved.name || '车间仿真沙盒', nodes: saved.nodes, edges: saved.edges };
    }
    return { ...initialSimState(), projectName: '车间仿真沙盒' };
  });

  const [run, setRun] = useState<SimRunState>(EMPTY_RUN);
  const stopRef = useRef(false);

  const selectedNode = state.nodes.find((n) => n.id === state.selectedId) ?? null;

  const stopRun = useCallback(() => {
    stopRef.current = true;
    setRun((r) => ({ ...r, active: false, activeNodeId: null }));
  }, []);

  const runSim = useCallback(async () => {
    const plan = planSimulation(state.nodes, state.edges, DEFAULT_BATCH);
    stopRef.current = false;

    if (plan.errors.length > 0) {
      setRun({ active: false, activeNodeId: null, progress: 0, metrics: null, logs: plan.errors.map<SimLogEntry>((m) => ({
        ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: 'fail',
        msg: m,
      })) });
      return;
    }

    const initMetrics: SimMetrics = { total: plan.batch, passed: 0, defective: 0, reworked: 0, scrapped: 0, leadTimeMin: 0 };
    setRun({ active: true, activeNodeId: null, progress: 0, metrics: { ...initMetrics }, logs: [startLog(plan.batch)] });

    let good = plan.batch;
    let metrics = { ...initMetrics };

    for (let i = 0; i < plan.order.length; i++) {
      if (stopRef.current) return;
      const node = plan.order[i];
      const step = computeStep(node, good, plan, new Date());
      good = step.outGood;
      metrics = {
        ...metrics,
        passed: good,
        defective: metrics.defective + step.defective,
        reworked: metrics.reworked + step.reworked,
        scrapped: metrics.scrapped + step.scrapped,
        leadTimeMin: metrics.leadTimeMin + step.leadMin,
      };
      await new Promise((res) => setTimeout(res, STEP_DELAY));
      if (stopRef.current) return;
      setRun((r) => ({
        ...r,
        activeNodeId: node.id,
        progress: (i + 1) / plan.order.length,
        metrics: { ...metrics },
        logs: [...r.logs, step.log],
      }));
    }

    if (stopRef.current) return;
    const done: SimLogEntry = {
      ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      type: 'ok',
      msg: `仿真结束：投产 ${metrics.total} 件 → 合格发货 ${metrics.passed} 件，良率 ${((metrics.passed / metrics.total) * 100).toFixed(1)}%`,
    };
    setRun((r) => ({ ...r, active: false, activeNodeId: null, progress: 1, metrics: { ...metrics }, logs: [...r.logs, done] }));
  }, [state.nodes, state.edges]);

  return (
    <section className="sim-page">
      <SimToolbar state={state} dispatch={dispatch} run={run} onRun={runSim} onStop={stopRun} />
      <div className="sim-body">
        <SimTasks
          nodeCount={state.nodes.length}
          edgeCount={state.edges.length}
          onClear={() => dispatch({ type: 'CLEAR' })}
        />
        <div className="sim-main">
          <SimCanvas state={state} dispatch={dispatch} activeNodeId={run.activeNodeId} />
          <SimProps
            node={selectedNode}
            onChange={(props) => { if (state.selectedId) dispatch({ type: 'UPDATE_PROPS', id: state.selectedId, props }); }}
            onLabelChange={(label) => { if (state.selectedId) dispatch({ type: 'UPDATE_LABEL', id: state.selectedId, label }); }}
          />
        </div>
        <SimLog
          nodes={state.nodes.map((n) => ({ id: n.id, label: n.label, nodeType: n.nodeType }))}
          edges={state.edges}
          runLogs={run.logs}
          running={run.active}
          metrics={run.metrics}
        />
      </div>
      {run.active && (
        <div className="sim-run-bar">
          <div className="sim-run-progress">
            <div className="sim-run-fill" style={{ width: `${Math.round(run.progress * 100)}%` }} />
          </div>
          <span className="sim-run-pct">{Math.round(run.progress * 100)}%</span>
        </div>
      )}
    </section>
  );
}
