/**
 * 车间仿真沙盒 · 多工厂 / 多产线。
 * 四栏布局：工厂产线 | 工序库 | 画布+属性 | 运行日志。
 * 画布只渲染「当前激活产线」的工序，工厂/产线由 SimFactoryPanel 管理。
 * 支持「运行仿真」：工单沿工艺路线流转，实时日志 + 指标。
 */
import { useReducer, useState, useCallback, useRef, useEffect } from 'react';
import { simReducer, initialSimState, seedExampleState, getActiveLine, createNode } from './simReducer';
import { loadFromStorage } from './simStorage';
import { simulate, startLog, DEFAULT_BATCH, type SimLogEntry } from './simEngine';
import SimToolbar from './SimToolbar';
import SimFactoryPanel from './SimFactoryPanel';
import SimPalette from './SimPalette';
import SimCanvas from './SimCanvas';
import SimProps from './SimProps';
import SimEdgeEditor from './SimEdgeEditor';
import SimLog from './SimLog';
import type { SimRunState, SimNodeDef } from './simTypes';
import { NODE_LIBRARY } from './simTypes';
import './SimulatorPage.css';

// 运行时扩展工序库：直接写入 NODE_LIBRARY
function addCustomNodeDef(def: SimNodeDef) {
  (NODE_LIBRARY as any)[def.type] = def;
}

const BASE_DELAY = 650; // 基础动画间隔(ms)

const EMPTY_RUN: SimRunState = { active: false, activeNodeId: null, logs: [], metrics: null, progress: 0 };

export default function SimulatorPage() {
  const [state, dispatch] = useReducer(simReducer, null, () => {
    const saved = loadFromStorage();
    if (saved && saved.factories?.length) {
      return {
        ...initialSimState(),
        factories: saved.factories,
        activeFactoryId: saved.activeFactoryId,
        activeLineId: saved.activeLineId,
      };
    }
    return seedExampleState();
  });

  const activeLine = getActiveLine(state);
  const nodes = activeLine?.nodes ?? [];
  const edges = activeLine?.edges ?? [];

  const [run, setRun] = useState<SimRunState>(EMPTY_RUN);
  const [speed, setSpeed] = useState(1);
  const [scene, setScene] = useState('auto');
  const stopRef = useRef(false);

  // 全屏：整个仿真沙盒进入全屏，画布获得最大空间
  const pageRef = useRef<HTMLElement>(null);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onCh = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onCh);
    return () => document.removeEventListener('fullscreenchange', onCh);
  }, []);
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      pageRef.current?.requestFullscreen?.();
    }
  }, []);

  const selectedNode = nodes.find((n) => n.id === state.selectedId) ?? null;
  const selectedEdge = edges.find((e) => e.id === state.selectedEdgeId) ?? null;

  // 点击左侧工序库 → 在画布左上角区域级联摆放，避免堆叠，用户可再拖拽调整
  const handleAddNode = useCallback((type: string) => {
    const n = nodes.length;
    const x = 40 + (n % 5) * 150;
    const y = 40 + Math.floor(n / 5) * 130;
    const node = createNode(type, x + 60, y + 30);
    if (node) dispatch({ type: 'ADD_NODE', node });
  }, [nodes.length, dispatch]);

  const handleDeleteNode = useCallback(() => {
    if (state.selectedId) dispatch({ type: 'DELETE_NODE', id: state.selectedId });
  }, [state.selectedId, dispatch]);

  const stopRun = useCallback(() => {
    stopRef.current = true;
    setRun((r) => ({ ...r, active: false, activeNodeId: null }));
  }, []);

  const runSim = useCallback(async () => {
    const result = simulate(nodes, edges, DEFAULT_BATCH);
    stopRef.current = false;

    if (!result.ok) {
      setRun({
        active: false,
        activeNodeId: null,
        progress: 0,
        metrics: null,
        logs: result.errors.map<SimLogEntry>((m) => ({
          ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          type: 'fail',
          msg: m,
        })),
      });
      return;
    }

    const initLogs = [startLog(DEFAULT_BATCH)];
    setRun({
      active: true,
      activeNodeId: null,
      progress: 0,
      metrics: { ...result.metrics },
      logs: initLogs,
      edgeFlow: result.edgeFlow,
      nodeInflow: result.nodeInflow,
      nodeOutflow: result.nodeOutflow,
      bottleneckId: result.bottleneckId,
      bottleneck: result.bottleneck,
    });

    for (let i = 0; i < result.order.length; i++) {
      if (stopRef.current) return;
      const node = result.order[i];
      await new Promise((res) => setTimeout(res, BASE_DELAY / speed));
      if (stopRef.current) return;
      setRun((r) => ({
        ...r,
        activeNodeId: node.id,
        progress: (i + 1) / result.order.length,
        metrics: { ...result.metrics },
        logs: [...initLogs, ...result.logs.slice(0, i + 1)],
      }));
    }

    if (stopRef.current) return;
    const m = result.metrics;
    const done: SimLogEntry = {
      ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      type: 'ok',
      msg: `仿真结束：投产 ${m.total} 件 → 合格发货 ${m.passed} 件，良率 ${m.total > 0 ? ((m.passed / m.total) * 100).toFixed(1) : '0'}%`,
    };
    setRun((r) => ({
      ...r,
      active: false,
      activeNodeId: null,
      progress: 1,
      metrics: { ...m },
      logs: [...initLogs, ...result.logs, done],
    }));
  }, [nodes, edges]);

  return (
    <section className="sim-page" ref={pageRef}>
      <SimToolbar
        state={state}
        dispatch={dispatch}
        run={run}
        speed={speed}
        onSpeedChange={setSpeed}
        onRun={runSim}
        onStop={stopRun}
        isFullscreen={isFs}
        onToggleFullscreen={toggleFs}
      />
      <div className="sim-body">
        <SimFactoryPanel state={state} dispatch={dispatch} />
        <SimPalette onCreate={handleAddNode} onCustomNode={addCustomNodeDef} scene={scene} onSceneChange={setScene} />
        <div className="sim-main">
          <SimCanvas
            nodes={nodes}
            edges={edges}
            selectedId={state.selectedId}
            selectedEdgeId={state.selectedEdgeId}
            connectingFrom={state.connectingFrom}
            connectingPort={state.connectingPort}
            dispatch={dispatch}
            activeNodeId={run.activeNodeId}
            bottleneckId={run.bottleneckId}
            edgeFlow={run.edgeFlow}
          />
          {state.selectedEdgeId && selectedEdge ? (
            <SimEdgeEditor
              edge={selectedEdge}
              fromLabel={nodes.find((n) => n.id === selectedEdge.from)?.label ?? '起点'}
              toLabel={nodes.find((n) => n.id === selectedEdge.to)?.label ?? '终点'}
              onChange={(patch) => dispatch({ type: 'UPDATE_EDGE', id: selectedEdge.id, patch })}
              onDelete={() => dispatch({ type: 'DELETE_EDGE', id: selectedEdge.id })}
              onClose={() => dispatch({ type: 'SELECT_EDGE', id: null })}
            />
          ) : (
            <SimProps
              node={selectedNode}
              onChange={(props) => { if (state.selectedId) dispatch({ type: 'UPDATE_PROPS', id: state.selectedId, props }); }}
              onLabelChange={(label) => { if (state.selectedId) dispatch({ type: 'UPDATE_LABEL', id: state.selectedId, label }); }}
              onDelete={handleDeleteNode}
            />
          )}
        </div>
        <SimLog
          nodes={nodes.map((n) => ({ id: n.id, label: n.label, nodeType: n.nodeType }))}
          edges={edges}
          runLogs={run.logs}
          running={run.active}
          metrics={run.metrics}
        />
      </div>
      {/* KPI 指标行 */}
      {run.metrics && (
        <div className="sim-kpi-bar">
          <div className="sim-kpi">
            <span className="sim-kpi-value">{run.metrics.passed}</span>
            <span className="sim-kpi-label">合格产量 (件)</span>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-value">
              {run.metrics.total > 0 ? ((run.metrics.passed / run.metrics.total) * 100).toFixed(1) : 0}%
            </span>
            <span className="sim-kpi-label">
              合格率
              <span className={`sim-kpi-trend ${run.metrics.passed / run.metrics.total >= 0.95 ? 'up' : 'down'}`}>
                {' '}{run.metrics.passed / run.metrics.total >= 0.95 ? '↑' : '↓'}
              </span>
            </span>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-value" style={{ color: run.metrics.scrapped > 0 ? 'var(--danger)' : 'var(--fg)' }}>
              {run.metrics.scrapped + run.metrics.defective}
            </span>
            <span className="sim-kpi-label">不良品 (件)</span>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-value">{run.metrics.leadTimeMin.toFixed(1)}</span>
            <span className="sim-kpi-label">生产工时 (min)</span>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-value" style={{ color: 'var(--warn)' }}>{run.bottleneck?.label ?? '—'}</span>
            <span className="sim-kpi-label">
              瓶颈工序
              {run.bottleneck && (
                <span className="sim-kpi-sub">产能 {run.bottleneck.perShift} 件/班</span>
              )}
            </span>
          </div>
        </div>
      )}

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
