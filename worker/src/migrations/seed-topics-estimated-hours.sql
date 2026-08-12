-- 重算全站 36 门课的 estimated_hours，消除「26 门扎堆 = 4」的占位假数据。
--
-- 换算依据（统一公式，面向零基础的阅读节奏）：
--   中文阅读 / 理解速度 ≈ 200 字/分钟
--   每章固定开销       = 15 分钟（进入、通读、回看「检验自己」段、停顿消化）
--   每道自测题         = 4 分钟（读题 + 思考 + 看解析）
--   总分钟 = 总字数/200 + 章数×15 + 题数×4
--   课时   = 向上取整到整小时（estimated_hours 为 INTEGER 列），下限 1 小时
--
-- 各课输入（章数 / 总字数 / 题数 → 原值 → 新值）：
--   pop-1010  1/849/3     → 1→1     pop-1011  1/941/3     → 2→1     pop-1012  1/1036/3    → 1→1   （科普短课）
--   work-order 2/3574/10  → 6→2     bom 2/2693/8          → 5→2     prod-report 2/2933/8 → 4→2
--   erp 9/3909/6          → 8→3     mes 8/3925/8          → 10→3    sql 8/17517/6        → 6→4
--   plc 5/8217/6          → 8→3     sql-interview 4/2809/0→ 4→2
--   rm-500 3章 2821~3989  → 4→1~2   rm-501 3章 5777~9378  → 4→2     rm-502 3章 3221~5381 → 4→2
--   rm-503 3章 6882~10286 → 4→2     mes-knowledge 16/26008/0 → 4→7   factory-mainline 13/11080/39 → 3→7
--   industrial-network 6/4415/0 → 4→2   linux-ops 5/3314/0 → 4→2   barcode-rfid 4/2596/0 → 4→2
--   project-management 5/3007/0 → 4→2   embedded 3/831/0 → 4→1   wms-aps-bi 3/1970/0 → 4→1   lean-ie 4/2392/0 → 4→2
--
-- 重跑安全：纯 UPDATE，按 id 设定确定值，重复执行幂等（设成相同值不改变任何行）。
-- 不碰其它列（slug/title/difficulty 等），只修正 estimated_hours。

UPDATE topics SET estimated_hours = 2  WHERE id = 1;
UPDATE topics SET estimated_hours = 2  WHERE id = 2;
UPDATE topics SET estimated_hours = 2  WHERE id = 3;
UPDATE topics SET estimated_hours = 3  WHERE id = 4;
UPDATE topics SET estimated_hours = 3  WHERE id = 5;
UPDATE topics SET estimated_hours = 4  WHERE id = 6;
UPDATE topics SET estimated_hours = 3  WHERE id = 7;
UPDATE topics SET estimated_hours = 2  WHERE id = 8;
UPDATE topics SET estimated_hours = 1  WHERE id = 1010;
UPDATE topics SET estimated_hours = 1  WHERE id = 1011;
UPDATE topics SET estimated_hours = 1  WHERE id = 1012;
UPDATE topics SET estimated_hours = 1  WHERE id = 5000;
UPDATE topics SET estimated_hours = 2  WHERE id = 5001;
UPDATE topics SET estimated_hours = 2  WHERE id = 5002;
UPDATE topics SET estimated_hours = 2  WHERE id = 5003;
UPDATE topics SET estimated_hours = 2  WHERE id = 5004;
UPDATE topics SET estimated_hours = 2  WHERE id = 5005;
UPDATE topics SET estimated_hours = 2  WHERE id = 5006;
UPDATE topics SET estimated_hours = 2  WHERE id = 5007;
UPDATE topics SET estimated_hours = 2  WHERE id = 5008;
UPDATE topics SET estimated_hours = 2  WHERE id = 5009;
UPDATE topics SET estimated_hours = 2  WHERE id = 5010;
UPDATE topics SET estimated_hours = 2  WHERE id = 5011;
UPDATE topics SET estimated_hours = 2  WHERE id = 5012;
UPDATE topics SET estimated_hours = 2  WHERE id = 5013;
UPDATE topics SET estimated_hours = 2  WHERE id = 5014;
UPDATE topics SET estimated_hours = 2  WHERE id = 5015;
UPDATE topics SET estimated_hours = 7  WHERE id = 5019;
UPDATE topics SET estimated_hours = 7  WHERE id = 9001;
UPDATE topics SET estimated_hours = 2  WHERE id = 6001;
UPDATE topics SET estimated_hours = 2  WHERE id = 6002;
UPDATE topics SET estimated_hours = 2  WHERE id = 6003;
UPDATE topics SET estimated_hours = 2  WHERE id = 6004;
UPDATE topics SET estimated_hours = 1  WHERE id = 6005;
UPDATE topics SET estimated_hours = 1  WHERE id = 6006;
UPDATE topics SET estimated_hours = 2  WHERE id = 6007;
