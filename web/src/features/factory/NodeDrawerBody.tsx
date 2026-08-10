/**
 * 抽屉正文 · 初学者线性学习流（零经验者专用，v2 重构）。
 *
 * 流程（对应产品 brief「学 → 测 → 上手」）：
 *   第一步  先搞懂    初级知识卡（大白话，不跳章节）
 *   第二步  测一下    内联自测题（答完即给解析）
 *   第三步  上手写    SQL 案例练习（BeginnerSqlLab：业务背景 + 逐行注释 + 语法提示卡
 *                           + 复制/填入参考解答 + 出错自动解析）
 *
 * 工厂模拟（sim）不在此路径内 —— 初学者先不碰搭产线，留给进阶用户。
 * 进度沿用既有 NODE_RESOURCE_DONE 事件，落 factory.progress（仅本地 KV 镜像）。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import type { LaidNode } from './factoryFlow.data';
import { oneLinerOf } from './factoryStages.data';
import { NODE_RESOURCE_DONE } from './useNodeProgress';
import { beginnerPathOf } from './beginnerPath.data';
import { BeginnerSqlLab } from './BeginnerSqlLab';
import { BeginnerQuiz } from './BeginnerQuiz';

export interface NodeDrawerBodyProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
  /** 请求抽屉展宽（仅 SQL 步骤为 true）。父级据此切 .is-wide。 */
  onWideChange?: (wide: boolean) => void;
}

export default function NodeDrawerBody({
  node, resources, onWideChange,
}: NodeDrawerBodyProps) {
  const path = beginnerPathOf(node.key);
  const chapters = [...resources].filter((r) => r.type === 'chapter');
  const lede = oneLinerOf(node);
  const [sqlOpen, setSqlOpen] = useState(false);

  // SQL 步骤需要更宽的空间（编辑器 + 结果表）。
  useEffect(() => { onWideChange?.(sqlOpen); }, [sqlOpen, onWideChange]);
  useEffect(() => () => onWideChange?.(false), [onWideChange]);

  /** 完成某类实战 → 派发事件，useNodeProgress 监听落进度。refId 用节点 id 区分。 */
  const solve = (type: string, refId: number) => {
    window.dispatchEvent(
      new CustomEvent(NODE_RESOURCE_DONE, { detail: { type, refId } }),
    );
  };

  if (!path) {
    return (
      <div className="nd-body">
        <p className="nd-know">这个环节暂未准备初学者内容，先往后走，上线后会出现在这里。</p>
      </div>
    );
  }

  return (
    <div className="nd-body">
      {lede && <p className="nd-lede">{lede}</p>}

      {/* 第一步：初级知识卡 */}
      <section className="nd-sec">
        <div className="nd-sec-h"><Icon name="hint" size={16} className="inline-glyph" /><span className="caps">第一步 · 先搞懂</span></div>
        {path.knowledge.split('\n\n').map((para, i) => (
          <p key={i} className="nd-know">{para}</p>
        ))}
        <p className="nd-know nd-know-soft">这一步会落到：{path.systems}。</p>
        {chapters.length > 0 && (
          <Link to={`/chapters/${chapters[0].refId}`} className="text-link" style={{ fontSize: 'var(--text-xs)' }}>
            想深入看完整章节 →
          </Link>
        )}
      </section>

      {/* 第二步：自测题 */}
      <section className="nd-sec">
        <div className="nd-sec-h"><Icon name="quiz" size={16} className="inline-glyph" /><span className="caps">第二步 · 测一下懂没懂</span></div>
        <BeginnerQuiz questions={path.quiz} onAllCorrect={() => solve('quiz', node.id)} />
      </section>

      {/* 第三步：SQL 案例练习 */}
      <section className="nd-sec">
        <div className="nd-sec-h"><Icon name="sql" size={16} className="inline-glyph" /><span className="caps">第三步 · 上手写 SQL</span></div>
        <BeginnerSqlLab
          sqlCase={path.sql}
          onPass={() => { setSqlOpen(true); solve('sql', node.id); }}
        />
      </section>
    </div>
  );
}
