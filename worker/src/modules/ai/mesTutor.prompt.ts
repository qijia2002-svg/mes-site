/**
 * mesTutor.prompt.ts — MES 领域化 AI 导师「Prompt 地基」
 *
 * 改造自 Mr. Ranedeer AI Tutor（v2.7 纯 System Prompt 模板），按本平台铁律收敛：
 *  - Emojis = Disabled（P0：功能/官方文案禁 emoji）
 *  - Reasoning Framework = Causal（ADR-021：讲系统不打生活比方，只用因果链）
 *  - Depth = 锁定零基础（目标人群为制造业转行新人，零背景）
 *  - 去掉 GPT-4 Code Interpreter 段（改用 Workers AI @cf/meta/llama-3.2-3b-instruct）
 *  - 保留 /plan → /start → /test 教学循环，并适配 MES 章节 / 术语上下文
 *
 * 该模块只负责「组装 prompt」：把系统指令 + 学员上下文 + 历史 + 当前输入拼成一个
 * 字符串，交给 ai.routes.ts 的 guardedAiRun 统一调用（单 prompt 入参，符合 Workers AI
 * llama-3.2-3b-instruct 的 completion 式调用约定）。不在此处调 AI。
 *
 * 针对 3B 小模型承载力：① 开头强指令「只回应输入、勿复述设定」；② 用【示范】锚定因果
 * 框架与中文结构化输出（不用对话式 few-shot，避免小模型续写示例）；③ 调用侧设 max_tokens
 * 上限防止失控生成。后续若升级更强模型，可把本 prompt 迁到 messages[system] 获更稳定跟随。
 */

export interface TutorContext {
  /** 当前学习主题，如 "MRP" */
  topic?: string;
  /** 当前章节，如 "第3章 物料需求计划" */
  chapter?: string;
  /** 当前生词 / 术语，如 "工单" */
  term?: string;
  /** 当前学习阶段，如 "零基础重学" */
  stage?: string;
}

export interface TutorTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * MES 导师系统指令（精简版，适配 3B 小模型承载力）。
 * 锁定不可由学员改动的取值以「【配置】」段单列，避免模型在对话中被带偏。
 */
export const MES_TUTOR_SYSTEM = `你是一名 AI 导师，服务于「MES 实训平台」，帮助零基础转行新人掌握 MES / WMS / ERP 与制造业数字化。

【硬规则】
1. 用中文回复；语气专业、耐心、鼓励；不使用任何表情符号。
2. 学员没有制造业背景，术语第一次出现必须先给一句大白话定义，再展开。
3. 解释系统或流程一律用「原因→结果 / 输入→处理→输出」的因果链，说明"为什么要有这一步"。严禁用生活比方（如把工单比作点外卖）解释机制；改用真实工厂场景（下料、机加工、组装、检验）举例。
4. 【示范】学员问"工单是什么"时，如此作答：工单是车间执行生产的任务单。因为要按订单把原材料变成成品（因），所以需要一张单子写明"做什么、做多少、用什么工艺、何时交"（果）；车间据此加工，计划才变成可追踪、可报工的实际动作。
5. 从最浅处讲起，循序渐进；一次聚焦一个主题，结构清晰（短段落、有序列表）。
6. 不知道就说不知道，并指引到对应章节，不编造。
7. 回答控制在 180 字内，说完即止；不要附加格式说明、不要续写示例、不要重复标点或句子。

【命令】学员输入以 / 开头即为命令，只执行该命令，不要解释命令本身：
- /plan   ：基于当前上下文，输出分阶段学习路线图（每阶段含目标与预计产出）。
- /start  ：就当前主题开讲一堂结构化微课（目标 → 核心概念 → 真实工厂例子 → 一个确认性小问题）。
- /test   ：出分层测验（难度 3/6/9 各一题），学员作答后逐题点评对错与原因。
- /example：给一个具体工厂实例，演示该知识点如何落地。
- /continue：从上一处继续，不重复已讲内容。
- /config ：列出当前导师配置。
- /help   ：列出全部命令。

【当前导师配置（不可更改）】深度=零基础；推理=因果；表情=关闭；语言=中文；风格=结构拆解式。`;

/** 识别命令：以 / 开头取首个词，否则返回空串。 */
export function detectTutorCommand(message: string): string {
  const m = message.trim();
  if (!m.startsWith('/')) return '';
  const cmd = m.split(/\s+/)[0].toLowerCase();
  return cmd;
}

/**
 * 组装完整 prompt：用 LLaMA-3 原生对话模板包裹，激活指令跟随并给出停止信号，
 * 避免 3B instruct 模型把"拼接 prompt"当成对话续写。
 *
 * 结构：<|begin_of_text|><|start_header_id|>system<|end_header_id|>
 *        {系统设定}
 *       <|eot_id|><|start_header_id|>user<|end_header_id|>
 *        {学员上下文 + 历史 + 当前输入}
 *       <|eot_id|><|start_header_id|>assistant<|end_header_id|>
 *        （模型从此处续写单条回复，遇 <|eot_id|> 自然停止）
 *
 * history 仅取最近 4 轮，避免 3B 模型上下文被淹没。
 */
export function buildTutorPrompt(
  message: string,
  ctx?: TutorContext,
  history?: TutorTurn[],
): string {
  const ctxLines: string[] = [];
  if (ctx?.topic) ctxLines.push(`主题=${ctx.topic}`);
  if (ctx?.chapter) ctxLines.push(`章节=${ctx.chapter}`);
  if (ctx?.term) ctxLines.push(`术语=${ctx.term}`);
  if (ctx?.stage) ctxLines.push(`阶段=${ctx.stage}`);
  const ctxBlock = ctxLines.length ? `（上下文：${ctxLines.join('；')}）` : '';

  const histLines: string[] = [];
  if (history && history.length) {
    for (const h of history.slice(-4)) {
      histLines.push(`${h.role === 'user' ? '学员' : '导师'}：${h.content}`);
    }
  }
  const userParts: string[] = [];
  if (histLines.length) userParts.push(histLines.join('\n'));
  userParts.push(`学员输入：${message}${ctxBlock}`);

  return (
    '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n' +
    MES_TUTOR_SYSTEM +
    '<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n' +
    userParts.join('\n') +
    '<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n'
  );
}
