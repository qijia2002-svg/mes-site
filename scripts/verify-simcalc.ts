import { runSim, pickFeedback, DEFAULT_PARAMS, type SimParams } from '../web/src/features/factory-sim/simCalc.ts';

let fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}

const d = runSim(DEFAULT_PARAMS);
console.log('--- 默认配置 ---');
check('M1 合格发货', d.M1, 53);
check('M3 在制品', d.M3, 47);
check('M4 交期', d.M4, 2);
check('M2 瓶颈产能', d.M2, 53);
check('M7 闲置率', d.M7, 76);
check('M5 报废', d.M5, 0);
check('M6 返工', d.M6, 3);
check('理论工时', d.theoreticalMin, 15.5);
check('瓶颈名', d.bottleneckLabel, '机加工');

console.log('--- 反直觉 A：k_f 1->3，M1 不动 ---');
const kf = runSim({ ...DEFAULT_PARAMS, kf: 3 });
check('k_f=3 M1', kf.M1, 53);
check('k_f=3 反馈', pickFeedback({ ...DEFAULT_PARAMS, kf: 3 }, kf), 'A');

console.log('--- 反直觉 B：k_b 1->2，M1 翻倍 ---');
const kb = runSim({ ...DEFAULT_PARAMS, kb: 2 });
check('k_b=2 M1', kb.M1, 100);
check('k_b=2 M4', kb.M4, 1);
check('k_b=2 反馈', pickFeedback({ ...DEFAULT_PARAMS, kb: 2 }, kb), 'B');

console.log('--- 反直觉 C：Q 100->200，WIP 爆炸 ---');
const q2 = runSim({ ...DEFAULT_PARAMS, Q: 200 });
check('Q=200 M3', q2.M3, 147);
check('Q=200 M4', q2.M4, 4);
check('Q=200 M1', q2.M1, 53);
check('Q=200 反馈', pickFeedback({ ...DEFAULT_PARAMS, Q: 200 }, q2), 'C');

console.log('--- 反直觉 F：p 5->15，发货几乎不动 ---');
const p15 = runSim({ ...DEFAULT_PARAMS, p: 15 });
check('p=15 M1', p15.M1, 52);
check('p=15 M5', p15.M5, 1);
check('p=15 M6', p15.M6, 7);

console.log('--- 反直觉 E：B 100->25 且换型开，发货下降 ---');
const b25 = runSim({ ...DEFAULT_PARAMS, B: 25, swapOn: true });
check('B=25 swapOn M1', b25.M1, 44);
check('B=25 反馈(刚开换型)', pickFeedback({ ...DEFAULT_PARAMS, B: 25, swapOn: true }, b25, 'swap'), 'E');

console.log('--- 反直觉 I：班次 1->2，产能翻倍交期减半 ---');
const sh2 = runSim({ ...DEFAULT_PARAMS, shift: 2 });
check('shift=2 M2', sh2.M2, 106);
check('shift=2 M1', sh2.M1, 100);
check('shift=2 M4', sh2.M4, 1);
check('shift=2 反馈', pickFeedback({ ...DEFAULT_PARAMS, shift: 2 }, sh2, 'shift'), 'I');

const all: SimParams[] = [d, kf, kb, q2, p15, b25, sh2];
const hasAbbr = JSON.stringify(all).match(/MES|MRP|BOM|APS|OEE/gi);
console.log('--- 缩写泄漏检查 ---');
check('输出无 MES/MRP/BOM/APS/OEE', hasAbbr, null);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
