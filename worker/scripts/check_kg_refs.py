#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知识点连线图 · 指认引用自检（静态，无需 D1）
=========================================
读取 seed-knowledge-graph.sql 里 knowledge_links 的全部指认，
逐项核对 source_ref 在对应源种子文件中真实存在，防止「悬空引用」。

校验维度：
  · node       → flow_nodes（generic-factory 的 node_key）
  · explainer  → node_explainers（id 9501–9524 区间）
  · micro      → micro_practices（id 9407/9409/9411）
  · sql_ex     → sql_exercises（id 9302/9303）
  · topic      → topics（id 1/2/3/6）
  · glossary   → dict_data（type_key='mes' 且 value 命中）

用法：python3 check_kg_refs.py   （在 worker 目录下，或任意位置自动定位 migrations）
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = os.path.abspath(os.path.join(HERE, "..", "src", "migrations"))
if not os.path.isdir(MIG):
    # 兜底：从 cwd 找
    MIG = os.path.join(os.getcwd(), "src", "migrations")


def read(name):
    with open(os.path.join(MIG, name), encoding="utf-8") as f:
        return f.read()


def err(msg):
    print("  [FAIL] " + msg)
    err.failed += 1


err.failed = 0


def main():
    seed = read("seed-knowledge-graph.sql")

    # ---- 1. 收集 generic-factory 的 node_key ----
    fg = read("seed-flowchart-generic.sql")
    node_keys = set(re.findall(r"slug='generic-factory'\)\s*,\s*'([^']+)'", fg))

    # ---- 2. explainer ids（9501–9524 区间）----
    exp = read("seed-learn-redesign-explainers.sql")
    explainer_ids = set(int(x) for x in re.findall(r"(950\d|951\d|952\d)", exp))

    # ---- 3. micro ids ----
    mic = read("seed-learn-redesign-hints-micro.sql")
    micro_ids = set(int(x) for x in re.findall(r"(9407|9409|9411)", mic))

    # ---- 4. sql_ex ids（扫描所有迁移，稳妥）----
    sql_ex_ids = set()
    for fn in os.listdir(MIG):
        if fn.endswith(".sql"):
            txt = read(fn)
            for x in re.findall(r"(9302|9303)", txt):
                sql_ex_ids.add(int(x))

    # ---- 5. topic ids ----
    topic_ids = set()
    for fn in ("seed.sql", "seed-knowledge.sql"):
        txt = read(fn)
        for m in re.finditer(r"topics\s*\(id[^)]*\)\s*VALUES\s*\((\d+)\s*,", txt):
            topic_ids.add(int(m.group(1)))

    # ---- 6. glossary values（按 type_key 分桶）----
    glossary_vals = {}  # type_key -> set(values)
    for fn in os.listdir(MIG):
        if fn.endswith(".sql"):
            txt = read(fn)
            for m in re.finditer(r"\(\s*'([a-z_]+)'\s*,\s*'([^']+)'", txt):
                glossary_vals.setdefault(m.group(1), set()).add(m.group(2))

    # ---- 解析 seed-knowledge-graph.sql 的 knowledge_links ----
    # 匹配每一行指认：concept 子查询 + source_type + source_ref
    link_re = re.compile(
        r"concepts WHERE key='([^']+)'\),\s*'(node|explainer|micro|sql_ex|topic|glossary)',\s*"
        r"(?:\(SELECT id FROM flow_nodes WHERE node_key='([^']+)'[^)]*\)|"
        r"\(SELECT id FROM dict_data WHERE type_key='([^']+)' AND value='([^']+)' LIMIT 1\)|"
        r"(\d+))",
        re.MULTILINE,
    )

    total = 0
    by_type = {}
    for m in link_re.finditer(seed):
        concept, stype, node_key, gloss_type, gloss_val, num = m.groups()
        total += 1
        by_type[stype] = by_type.get(stype, 0) + 1
        if stype == "node":
            if node_key in node_keys:
                print(f"  [OK ] concept={concept:18} node  {node_key}")
            else:
                err(f"concept={concept} node  '{node_key}' 不在 generic-factory 节点中")
        elif stype == "glossary":
            pool = glossary_vals.get(gloss_type, set())
            if gloss_val in pool:
                print(f"  [OK ] concept={concept:18} glossary({gloss_type})  '{gloss_val}'")
            else:
                err(f"concept={concept} glossary  '{gloss_val}' 未命中 dict_data(type_key='{gloss_type}')")
        else:
            val = int(num)
            pool = {
                "explainer": explainer_ids,
                "micro": micro_ids,
                "sql_ex": sql_ex_ids,
                "topic": topic_ids,
            }[stype]
            if val in pool:
                print(f"  [OK ] concept={concept:18} {stype:9} {val}")
            else:
                err(f"concept={concept} {stype} {val} 在源种子中未找到")

    # ---- 概念数核对 ----
    concept_keys = re.findall(r"\(\d+,\s*'([a-z_]+)',", seed)
    print("\n=== 汇总 ===")
    print(f"concepts 行数（解析自 VALUES）: {len(concept_keys)}")
    print(f"  键: {', '.join(concept_keys)}")
    print(f"knowledge_links 指认总数: {total}")
    print(f"  按类型: {by_type}")
    print(f"节点池 node_key 数: {len(node_keys)}")
    print(f"explainer id 数: {len(explainer_ids)}（区间 {min(explainer_ids)}–{max(explainer_ids)}）")
    print(f"micro id 数: {len(micro_ids)}")
    print(f"sql_ex id 数: {len(sql_ex_ids)}")
    print(f"topic id 数: {len(topic_ids)}")
    print(f"glossary value 数（按 type_key 分桶）: {sum(len(v) for v in glossary_vals.values())}（{', '.join(f'{k}={len(v)}' for k, v in glossary_vals.items())}）")

    print("\n=== 结论 ===")
    if err.failed == 0:
        print(f"PASS · 全部 {total} 条指认均命中真实工件，无悬空引用。")
        return 0
    else:
        print(f"FAIL · {err.failed} 条指认未命中，请修正后再部署。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
