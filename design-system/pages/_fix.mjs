import fs from 'fs';

const W = 44;
const w = (s) =>
  [...s].reduce((n, c) => {
    const p = c.codePointAt(0);
    const wide =
      (p >= 0x1100 && p <= 0x115f) ||
      (p >= 0x2e80 && p <= 0xa4cf) ||
      (p >= 0xac00 && p <= 0xd7a3) ||
      (p >= 0xf900 && p <= 0xfaff) ||
      (p >= 0xfe30 && p <= 0xfe4f) ||
      (p >= 0xff00 && p <= 0xff60) ||
      (p >= 0xffe0 && p <= 0xffe6);
    return n + (wide ? 2 : 1);
  }, 0);
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - w(s)));

const O = [];
const line = (a, b, n) => a + '─'.repeat(n) + b;
const row = (s, note) => O.push('│' + pad(s, W) + '│' + (note ? '  ' + note : ''));
const CW = W - 4;
const cTop = () => row(' ' + line('┌', '┐', CW) + ' ');
const cMid = () => row(' ' + line('├', '┤', CW) + ' ');
const cBot = () => row(' ' + line('└', '┘', CW) + ' ');
const cRow = (s, note) => row(' │' + pad(s, CW) + '│ ', note);
const gap = (note) => row('         │  ⟦add⟧', note);
const right = (left, rightPart) => left + pad('', CW - w(left) - w(rightPart)) + rightPart;

O.push(line('┌', '┐', W));
row(' 断路器装配线 v2' + pad('', W - w(' 断路器装配线 v2') - 7) + '⟦more⟧ ', '← 吸顶 52');
O.push(line('├', '┤', W));
cTop();
cRow(right(' 010  ◧  下料', '⟦grip⟧ '), '← 工序行 72px');
cRow('         BL-01 · 8min', '   ⟦grip⟧ = 44×44 拖拽手柄');
cBot();
gap('← 20px 间隙，中点为插入按钮');
cTop();
cRow(right(' 020  ◧  机加工', '⟦grip⟧ '));
cRow('         CNC-01 · 12min');
cBot();
gap();
cTop();
cRow(right(' 030  ◧  焊接', '⟦warn⟧ ⟦grip⟧ '), '← 异常行 --danger');
cRow('         WD-02 · 15min');
cMid();
cRow(' 焊接工序缺料停线', '← 内联展开，不用浮层气泡');
cRow(' 上道产出 80 件，需 100 件，差 20 件');
cRow(' [查看解决方案] [补料后重跑]');
cBot();
gap();
cTop();
cRow(right(' 040  ◧  质检', '⟦grip⟧ '));
cBot();
row('');
cTop();
cRow('        ⟦add⟧  添加工序', '← 全宽 Primary 44px');
cBot();
O.push(line('├', '┤', W));
row('  ⟦run⟧ 投产运行     1×      00:04', '← 吸底运行条（玻璃）');
O.push(line('├', '┤', W));
row('  工作台   课程   路径   SQL   登录', '← 现有 .mobile-tabbar');
O.push(line('└', '┘', W));

const f = 'routing-builder.md';
const src = fs.readFileSync(f, 'utf8').split('\n');
// 代码块内容为第 499..532 行（1-based），即索引 498..531
const before = src.slice(0, 498);
const after = src.slice(532);
fs.writeFileSync(f, [...before, ...O, ...after].join('\n'));
console.log('已替换移动端线框，' + O.length + ' 行');
