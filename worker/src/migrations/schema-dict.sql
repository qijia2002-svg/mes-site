-- 名称翻译 / 专业词典：字典类型 + 字典数据（借鉴 RuoYi 字典管理结构，按需裁剪）
-- dict_type：4 个分组（SQL 基础 / 数据库 / 编程通用 / MES 领域）
-- dict_data：每个英文词一条记录，含词性/中文/例句/分类/详解
-- 幂等：CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE（重复执行安全）

CREATE TABLE IF NOT EXISTS dict_type (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type_key   TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  status     INTEGER NOT NULL DEFAULT 1,
  remark     TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dict_data (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type_key   TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  pos        TEXT,
  zh         TEXT,
  example    TEXT,
  example_zh TEXT,
  category   TEXT,
  detail     TEXT,
  sort       INTEGER NOT NULL DEFAULT 0,
  status     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (type_key, value)
);

CREATE INDEX IF NOT EXISTS idx_dict_data_type  ON dict_data(type_key);
CREATE INDEX IF NOT EXISTS idx_dict_data_value ON dict_data(value);

-- ═══ 字典类型 ═══
INSERT OR IGNORE INTO dict_type (type_key, name, sort, status, remark, created_at, updated_at)
VALUES
  ('sql_basic',  'SQL 基础', 1, 1, 'SQL 关键字与基础语法', 1700000000000, 1700000000000),
  ('database',   '数据库',   2, 1, '关系型数据库概念',     1700000000000, 1700000000000),
  ('programming','编程通用', 3, 1, '编程通用术语',         1700000000000, 1700000000000),
  ('mes',        'MES 领域', 4, 1, '制造执行系统领域术语', 1700000000000, 1700000000000);

-- ═══ SQL 基础 ═══
INSERT OR IGNORE INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
VALUES
  ('sql_basic','SELECT','v.','从数据库中查询数据','SELECT * FROM table','从表中选择所有数据','查询','SELECT 是数据库查询语句的关键字，用于从数据库中获取数据。',1,1,1700000000000,1700000000000),
  ('sql_basic','FROM','prep.','指定数据的来源表','SELECT * FROM users','从 users 表中查询所有记录','数据来源','FROM 后接要查询的表名，是 SELECT 语句的数据来源。',2,1,1700000000000,1700000000000),
  ('sql_basic','WHERE','conj.','条件过滤，只返回满足条件的行','SELECT * FROM t WHERE id = 1','只查 id 等于 1 的行','条件','WHERE 子句用于筛选记录，支持 =、>、LIKE 等条件。',3,1,1700000000000,1700000000000),
  ('sql_basic','JOIN','v.','连接多张表，按关联字段合并结果','JOIN orders ON orders.user_id = users.id','按 user_id 关联订单与用户','关联','JOIN 用于把多张相关表的数据按关联键拼成一张结果集。',4,1,1700000000000,1700000000000),
  ('sql_basic','INSERT','v.','向表中插入新记录','INSERT INTO t (name) VALUES ("A")','向表 t 插入一条 name 为 A 的记录','写入','INSERT 用于新增数据行，需配合 VALUES 提供字段值。',5,1,1700000000000,1700000000000),
  ('sql_basic','UPDATE','v.','更新表中已有记录','UPDATE t SET x = 1 WHERE id = 1','把 id 为 1 的记录的 x 改为 1','修改','UPDATE 修改满足条件的行，通常必须带 WHERE 否则全表更新。',6,1,1700000000000,1700000000000),
  ('sql_basic','DELETE','v.','删除表中的记录','DELETE FROM t WHERE id = 1','删除 id 为 1 的记录','删除','DELETE 删除满足条件的行，务必加 WHERE 以免清空整张表。',7,1,1700000000000,1700000000000),
  ('sql_basic','INDEX','n.','索引，加速查询的数据库结构','CREATE INDEX idx ON t(col)','在 t 表的 col 列上建索引','性能','索引像书的目录，能大幅加快按该列的查询速度，但会占用存储。',8,1,1700000000000,1700000000000),
  ('sql_basic','GROUP BY','clause','分组，按指定列聚合统计','SELECT dept, COUNT(*) FROM emp GROUP BY dept','按部门分组统计人数','聚合','GROUP BY 把相同值的行归为一组，常配合 COUNT/SUM 等聚合函数。',9,1,1700000000000,1700000000000),
  ('sql_basic','ORDER BY','clause','排序，按指定列升序或降序排列结果','SELECT * FROM t ORDER BY score DESC','按分数从高到低排序','排序','ORDER BY 控制结果顺序，ASC 升序、DESC 降序，可多列排序。',10,1,1700000000000,1700000000000),
  ('sql_basic','HAVING','clause','分组后筛选，过滤聚合结果','HAVING COUNT(*) > 5','只保留数量大于 5 的组','聚合','HAVING 与 WHERE 类似，但作用于 GROUP BY 之后的聚合结果。',11,1,1700000000000,1700000000000),
  ('sql_basic','LIMIT','clause','限制返回的行数','SELECT * FROM t LIMIT 10','只取前 10 行','限制','LIMIT 控制返回记录数，常用于分页（配合 OFFSET）。',12,1,1700000000000,1700000000000);

-- ═══ 数据库 ═══
INSERT OR IGNORE INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
VALUES
  ('database','TABLE','n.','表，数据库中按行列组织的二维数据集合','CREATE TABLE orders (id INT)','创建一张名为 orders 的表','数据对象','表是关系型数据库存储数据的基本单位，由行（记录）和列（字段）组成。',1,1,1700000000000,1700000000000),
  ('database','VIEW','n.','视图，基于查询的虚拟表','CREATE VIEW v AS SELECT * FROM t','创建一个基于查询的视图','数据对象','视图不存数据，只是保存的查询，可像表一样查询，用于权限与简化。',2,1,1700000000000,1700000000000),
  ('database','SCHEMA','n.','模式，数据库的表结构与约束定义','ALTER SCHEMA','修改模式','结构','Schema 描述数据库的组织方式，包括表、字段、类型与关系。',3,1,1700000000000,1700000000000),
  ('database','PRIMARY KEY','n.','主键，唯一标识一行记录的列','id INT PRIMARY KEY','id 设为主键','约束','主键的值在表中唯一且非空，用于精确定位一行。',4,1,1700000000000,1700000000000),
  ('database','FOREIGN KEY','n.','外键，关联另一张表的主键','FOREIGN KEY (uid) REFERENCES users(id)','uid 关联 users 表的主键','约束','外键保证引用完整性，使两表数据建立关联。',5,1,1700000000000,1700000000000),
  ('database','TRANSACTION','n.','事务，一组要么全成功要么全失败的操作','BEGIN; ... COMMIT;','开启事务并提交','一致性','事务满足 ACID：原子性、一致性、隔离性、持久性。',6,1,1700000000000,1700000000000),
  ('database','QUERY','n. / v.','查询；向数据库发起的检索请求','Run a query to fetch records','执行一次查询以获取记录','查询','query 既可作名词（一条查询语句），也可作动词（执行查询）。',7,1,1700000000000,1700000000000),
  ('database','CONSTRAINT','n.','约束，限制列中数据的规则','NOT NULL / UNIQUE','非空 / 唯一约束','约束','约束保证数据合法，如主键、外键、唯一、检查约束等。',8,1,1700000000000,1700000000000),
  ('database','NORMALIZE','v.','规范化，拆分表以减少冗余','normalize to 3NF','规范到第三范式','设计','数据库规范化通过拆分表降低冗余、避免更新异常。',9,1,1700000000000,1700000000000),
  ('database','TRIGGER','n.','触发器，表发生增删改时自动执行的代码','CREATE TRIGGER ...','创建触发器','自动化','触发器在特定事件（INSERT/UPDATE/DELETE）前后自动运行，用于审计或同步。',10,1,1700000000000,1700000000000),
  ('database','DATABASE','n.','数据库，有组织地存储和管理数据的系统','Connect to the database','连接到数据库','存储','数据库用于持久化存储结构化数据，常见如 MySQL、PostgreSQL。',11,1,1700000000000,1700000000000),
  ('database','VALUE','n.','值，字段中存储的具体数据','SET value = 10','把 value 设为 10','数据','value 指某个字段或变量当前保存的具体数据内容。',12,1,1700000000000,1700000000000);

-- ═══ 编程通用 ═══
INSERT OR IGNORE INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
VALUES
  ('programming','FUNCTION','n.','函数，可复用的代码块，接收输入返回结果','function add(a,b){return a+b}','定义一个相加函数','编程','函数封装逻辑，提高复用性与可维护性。',1,1,1700000000000,1700000000000),
  ('programming','CLASS','n.','类，面向对象中对象的模板','class User { name }','定义一个用户类','编程','类描述对象的属性与方法，是 OOP 的基本结构。',2,1,1700000000000,1700000000000),
  ('programming','VARIABLE','n.','变量，存储可变数据的命名容器','let x = 1','声明变量 x 并赋值为 1','编程','变量在内存中占一块空间，名字指向其值。',3,1,1700000000000,1700000000000),
  ('programming','ARRAY','n.','数组，按索引有序存储的同类型集合','const a = [1,2,3]','声明一个数组','编程','数组用下标访问元素，适合顺序存储与遍历。',4,1,1700000000000,1700000000000),
  ('programming','LOOP','n.','循环，重复执行一段代码','for(let i=0;i<10;i++)','循环 10 次','编程','循环用于批量处理，常见有 for / while。',5,1,1700000000000,1700000000000),
  ('programming','RECURSION','n.','递归，函数调用自身解决问题','function f(n){return n*f(n-1)}','用递归算阶乘','编程','递归把大问题拆成相同结构的子问题，需有终止条件。',6,1,1700000000000,1700000000000),
  ('programming','API','n.','应用程序接口，系统间通信的契约','call the REST API','调用 REST 接口','编程','API 定义请求与响应格式，让前后端或不同服务协作。',7,1,1700000000000,1700000000000),
  ('programming','REGEX','n.','正则表达式，用于模式匹配的文本规则','\\d+ 匹配数字','用正则提取数字','编程','正则用特殊符号描述字符串模式，常用于校验与提取。',8,1,1700000000000,1700000000000),
  ('programming','CACHE','n.','缓存，临时存储高频数据以加速访问','cache the result','缓存结果','性能','缓存把慢速来源的结果放在更快的介质，减少重复计算或请求。',9,1,1700000000000,1700000000000),
  ('programming','THREAD','n.','线程，进程内可并发执行的最小单位','run in a worker thread','在子线程中运行','并发','多线程可并行处理任务，但需处理共享资源的竞争。',10,1,1700000000000,1700000000000),
  ('programming','ASYNC','adj.','异步，不阻塞主流程地等待结果','await fetch()','异步等待请求返回','并发','异步编程用回调/Promise 在等待时不卡住界面。',11,1,1700000000000,1700000000000),
  ('programming','NULL','n.','空值，表示“无数据”的特殊标记','WHERE col IS NULL','查找空值的列','数据','NULL 不等于 0 也不等于空串，需用 IS NULL 判断。',12,1,1700000000000,1700000000000);

-- ═══ MES 领域 ═══
INSERT OR IGNORE INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
VALUES
  ('mes','BOM','n.','物料清单，产品所需物料及数量的清单','BOM of a pump','一台泵的物料清单','MES','BOM 是制造的基础，描述产品由哪些物料构成及层级关系。',1,1,1700000000000,1700000000000),
  ('mes','WORK ORDER','n.','工单，下达给车间的具体生产指令','release a work order','下发一张工单','MES','工单驱动车间执行，包含产品、数量、工艺与交期。',2,1,1700000000000,1700000000000),
  ('mes','ROUTING','n.','工艺路线，产品加工的步骤顺序','define routing for part','定义零件的工艺路线','MES','工艺路线规定工序先后顺序与所用设备，是排产依据。',3,1,1700000000000,1700000000000),
  ('mes','OEE','n.','设备综合效率，可用率×性能×良率的连乘','OEE = 0.85','设备综合效率 85%','MES','OEE 衡量设备真实产出效率，是制造业核心 KPI。',4,1,1700000000000,1700000000000),
  ('mes','KANBAN','n.','看板，拉动式生产的信号与物料看板','kanban pull','看板拉动','MES','看板控制工序间流转，仅在后工序需要时前工序才生产。',5,1,1700000000000,1700000000000),
  ('mes','TRACEABILITY','n.','可追溯性，正向/反向追踪产品来源与去向','lot traceability','批次追溯','MES','可追溯性让每批产品能查到原料、设备与操作记录。',6,1,1700000000000,1700000000000),
  ('mes','ERP','n.','企业资源计划，整合人财物产供销的系统','SAP ERP','SAP 企业资源计划','MES','ERP 统管企业资源，MES 偏车间执行，二者上下打通。',7,1,1700000000000,1700000000000),
  ('mes','PLC','n.','可编程逻辑控制器，产线设备的控制大脑','PLC controls the line','PLC 控制产线','MES','PLC 实时采集 IO 并控制设备，是自动化的核心硬件。',8,1,1700000000000,1700000000000),
  ('mes','SCADA','n.','数据采集与监控系统，集中监视控制现场','SCADA HMI','SCADA 人机界面','MES','SCADA 汇总现场数据并提供集中监控，常位于 PLC 之上。',9,1,1700000000000,1700000000000),
  ('mes','WIP','n.','在制品，已开工尚未完工的物料','WIP inventory','在制品库存','MES','WIP 反映产线在制量，是排产与交期管理的重点。',10,1,1700000000000,1700000000000),
  ('mes','LOT','n.','批次，同一条件下生产的一批产品','lot number','批号','MES','批次用于质量追溯与隔离，同一批共享批号。',11,1,1700000000000,1700000000000),
  ('mes','CYCLE TIME','n.','周期时间，完成一件产品所需的实际时长','cycle time 30s','周期时间 30 秒','MES','周期时间常作为线平衡与产能测算的基础。',12,1,1700000000000,1700000000000);
