import type { TutorSource } from '../../api/endpoints';

export interface TutorMsg {
  role: 'user' | 'assistant';
  content: string;
  /** 该条助手消息附带的 RAG 引用来源（桌面工作台来源面板展示）。 */
  sources?: TutorSource[];
}
