import { spawn, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
// 全局 setup 运行时 cwd = worker 目录；仓库根 = 上一级
const ROOT = path.resolve(process.cwd(), '..');
const MIG_DIR = path.join(ROOT, 'worker', 'src', 'migrations');
const SEED_FILE = path.join(ROOT, 'worker', '.seed.sql').replace(/\\/g, '/');

// 测试库采用「合并后的最新 schema」(schema.sql) 作为基线 —— 它已包含 redesign 后的全部列，
// 不可再叠加增量 schema-*/migration-* 文件（会重复加列）。后续如需 dict/flowchart 等模块表，
// 再针对性追加对应文件（并注意 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 幂等）。
const MIGRATION_FILES = ['schema.sql'];

const FIXTURE = `
INSERT OR IGNORE INTO topics
  (id, slug, title, description, modules, status, sort, created_at, updated_at)
VALUES
  (1, 'intro', 'MES 入门', 'desc', '["theory","quiz"]', 'published', 1, strftime('%s','now'), strftime('%s','now'));
INSERT OR IGNORE INTO chapters
  (id, topic_id, title, status, md_text, updated_at)
VALUES
  (1, 1, '第一章 工单的生命周期', 'published', '# 标题', strftime('%s','now'));
INSERT OR IGNORE INTO questions
  (id, chapter_id, type, stem, options, answer, sort, created_at)
VALUES
  (1, 1, 'single', 'MES 的核心目标是？', '["A","B","C","D"]', 'A', 1, strftime('%s','now'));
`;

let child: ReturnType<typeof spawn> | null = null;

function runWrangler(args: string[]): void {
  // 用 execSync（走 shell）并保留子进程输出，便于排查
  execSync(`npx wrangler ${args.map((a) => `"${a}"`).join(' ')}`, {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

async function waitFor(pred: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('等待 wrangler dev 就绪超时');
}

export async function setup(): Promise<void> {
  // 1. 拼接建表 + fixture SQL，写入绝对路径临时文件
  let sql = '';
  for (const f of MIGRATION_FILES) sql += readFileSync(path.join(MIG_DIR, f), 'utf-8') + '\n';
  sql += FIXTURE;
  writeFileSync(SEED_FILE, sql, 'utf-8');

  // 2. 播种本地 D1（与 wrangler dev --local 共用 .wrangler/state/v3）
  runWrangler(['d1', 'execute', 'mes-learning', '--local', '--file', SEED_FILE]);

  // 3. 若 8788 已被占用（例如手动起的 dev），直接复用；否则拉起 wrangler dev
  const alreadyUp = await fetch(BASE + '/api/v1/health')
    .then((r) => r.ok)
    .catch(() => false);
  if (!alreadyUp) {
    child = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT)], {
      cwd: ROOT,
      stdio: 'ignore',
      shell: true,
    });
  }

  // 4. 等待健康检查通过（本地 D1 + DO 绑定就绪）
  await waitFor(
    () =>
      fetch(BASE + '/api/v1/health')
        .then((r) => r.ok)
        .catch(() => false),
    120000,
  );
  console.log(`[api-tests] worker 就绪: ${BASE}`);
}

export async function teardown(): Promise<void> {
  if (child) {
    child.kill('SIGTERM');
    child = null;
  }
  try {
    rmSync(SEED_FILE);
  } catch {
    /* ignore */
  }
}
