/**
 * 车间仿真沙盒 · 多工厂 / 多产线。
 * 四栏布局：工厂产线 | 工序库 | 画布+属性 | 运行日志。
 * 画布只渲染「当前激活产线」的工序，工厂/产线由 SimFactoryPanel 管理。
 * 支持「运行仿真」：工单沿工艺路线流转，实时日志 + 指标。
 */
import { useReducer, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { simReducer, initialSimState, getActiveLine, createNode } from './simReducer';
import { loadFromStorage, saveToStorage, exportJSON, importJSON } from './simStorage';
import { simulate, startLog, DEFAULT_BATCH, type SimLogEntry } from './simEngine';
import { toSimSql } from './simToSql';
import SimToolbar from './SimToolbar';
import SimFactoryPanel from './SimFactoryPanel';
import SimPalette from './SimPalette';
import SimCanvas from './SimCanvas';
import SimProps from './SimProps';
import SimEdgeEditor from './SimEdgeEditor';
import SimLog from './SimLog';
import SimLevels from './SimLevels';
import type { LevelContext } from './simLevelDefs';
import type { SimRunState, SimNodeDef } from './simTypes';
import { NODE_LIBRARY } from './simTypes';
import { Icon } from '../../components/Icon';
import { buildGenericFactory, WO_DEMO, FLOW_KEYS, SIM_REF_ID, FLOW_LABELS } from './simScenario';
import { NODE_RESOURCE_DONE } from '../factory/useNodeProgress';
import { write as writeUserData } from '../../lib/userData';
import './SimulatorPage.css';

// 运行时扩展工序库：直接写入 NODE_LIBRARY
function addCustomNodeDef(def: SimNodeDef) {
  (NODE_LIBRARY as any)[def.type] = def;
}

const BASE_DELAY = 650; // 基础动画间隔(ms)

const EMPTY_RUN: SimRunState = { active: false, activeNodeId: null, logs: [], metrics: null, progress: 0, wip: {}, congestedEdges: [] };

export default function SimulatorPage() {
  // 接住流程图节点传来的 ?from=<node.key>，把沙盒预载成「同一个通用工厂」的对应切片。
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromRaw = params.get('from');
  const from = fromRaw && FLOW_KEYS.has(fromRaw) ? fromRaw : null;
  const fromLabel = from ? FLOW_LABELS[from] : null;

  const [state, dispatch] = useReducer(simReducer, null, () => {
    if (from) return buildGenericFactory(from);
    const saved = loadFromStorage();
    if (saved && saved.factories?.length) {
      return {
        ...initialSimState(),
        factories: saved.factories,
        activeFactoryId: saved.activeFactoryId,
        activeLineId: saved.activeLineId,
      };
    }
    // 工厂优先（Factory-First）：默认加载与流程图同一套通用工厂，
    // 而非早期原型的离散制造示例线。保证用户在流程图和仿真间看到同一个工厂。
    return buildGenericFactory();
  });

  // 训练关卡：当前选中的关卡（左侧 SimLevels 面板驱动，验收随最近一次仿真实时刷新）
  const [activeLevelId, setActiveLevelId] = useState('connect');

  // 自动存档：工厂 / 产线拓扑变化时写回云端镜像（userData），下次进沙盒即恢复。
  // 首帧挂载不写——避免从流程节点 ?from= 进来就把已存的自定义工厂覆盖成通用工厂。
  // 防抖 400ms：拖动节点会高频触发，只在用户停下后落一次盘，避免刷爆云端写入。
  const firstSave = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveToStorage(state);
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state.factories, state.activeFactoryId, state.activeLineId]);

  // 导入 / 导出：把当前激活产线存成单条工艺路线 JSON，便于备份与分享。
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const handleSave = useCallback(() => {
    void saveToStorage(state);
    setSaveFlash(true);
    window.setTimeout(() => setSaveFlash(false), 1500);
  }, [state]);
  const handleExport = useCallback(() => {
    const text = exportJSON(state);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factory-route-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);
  const handleImportClick = useCallback(() => {
    fileRef.current?.click();
  }, []);
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选同一文件
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const proj = importJSON(String(reader.result ?? ''));
      if (proj) dispatch({ type: 'LOAD_PROJECT', project: proj });
    };
    reader.readAsText(file);
  }, [dispatch]);

  const activeLine = getActiveLine(state);
  const nodes = activeLine?.nodes ?? [];
  const edges = activeLine?.edges ?? [];

  const [run, setRun] = useState<SimRunState>(EMPTY_RUN);
  const [speed, setSpeed] = useState(1);

  /** 两岛打通：把本次运行的明细报告序列化成 sim_* 表 SQL，写进用户数据，跳到 SQL 工坊。 */
  const handlePushToSql = useCallback(async () => {
    if (!run.report || !run.report.workOrder.woNo) return;
    const sql = toSimSql(run.report);
    await writeUserData('sim.sqlExport', sql);
    navigate('/sql-space?from=sim');
  }, [run.report, navigate]);
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

  // 重置本环节：停掉仿真，把沙盒整体恢复到该节点对应的通用工厂默认（替代旧「清空」）。
  const resetFactory = useCallback(() => {
    stopRun();
    dispatch({ type: 'LOAD_STATE', state: buildGenericFactory(from) });
  }, [from, stopRun]);

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

    const initLogs: SimLogEntry[] = [
      {
        ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: 'info',
        msg: `工单 ${WO_DEMO} 开始沿通用工厂主线流转（客户下单 → 发货出库）`,
      },
      startLog(DEFAULT_BATCH),
    ];
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
      wip: result.wip,
      congestedEdges: result.congestedEdges,
      report: result.report,
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

    // 仿真跑完即该节点的 sim 实战完成：派发完成事件，进度落进 factory.progress。
    if (from && SIM_REF_ID[from]) {
      window.dispatchEvent(
        new CustomEvent(NODE_RESOURCE_DONE, { detail: { type: 'sim', refId: SIM_REF_ID[from] } }),
      );
    }
  }, [nodes, edges, from]);

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
        onReset={resetFactory}
        onSave={handleSave}
        onExport={handleExport}
        onImport={handleImportClick}
        justSaved={saveFlash}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      {fromLabel && (
        <div className="sim-from-banner">
          <Icon name="routing" size={16} />
          <span>你正从「{fromLabel}」进入通用工厂 · 点「运行仿真」看工单 {WO_DEMO} 怎么流转</span>
        </div>
      )}
      <div className="sim-body">
        <SimFactoryPanel state={state} dispatch={dispatch} />
        <SimLevels
          activeLevelId={activeLevelId}
          onSelect={setActiveLevelId}
          ctx={{ nodes, edges, metrics: run.metrics, bottleneck: run.bottleneck ?? null }}
          onClear={() => dispatch({ type: 'CLEAR' })}
          nodeCount={nodes.length}
          edgeCount={edges.length}
        />
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
            wip={run.wip}
            congestedEdges={run.congestedEdges}
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
        <>
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
            <span className="sim-kpi-label">理论加工工时 (min)</span>
            <span className="sim-kpi-sub">不含排队/搬运/换型</span>
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
        <div className="sim-kpi-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handlePushToSql()}>
            <Icon name="sql" size={16} />
            送去 SQL 工坊查我这条线
          </button>
          <span className="sim-kpi-hint-text">把工单 / 报工 / 质检写进 SQL 库，切换「我的产线数据」即查</span>
        </div>
        </>
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
