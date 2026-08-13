/**
 * 订单到交付（Order-to-Delivery）业务单据流 —— 真实离散制造厂 16 步。
 *
 * 来源：用户提供的「客户下单 → … → 发货出库」价值流 + 每步配套 MES 单据。
 * 与工厂页现有 12 环节「系统视角」全景互补：本数据只讲「业务怎么走、配什么单」，
 * 不讲「归哪套系统管」（系统归属在 systems 字段里仅作轻量提示）。
 *
 * 正确性校正（对比用户原始稿）：
 *  · 第 9 步原稿写「车间生产加工：生成生产工单」——生产工单在 MRP / 生产计划阶段
 *    就已下发，车间只是「按工单加工、产出报工记录」。已改为「按生产工单加工制造，
 *    生成生产报工记录」，与单据映射（生产工单 + 生产报工记录）一致。
 *
 * 单据只收录用户明确列出者，外加两处明显隐含单（供应商送货单、发货通知单）；
 * 纯计划 / 评审类步骤（订单审核、物料需求计划）无独立业务单据，留空。
 */

export type ODPhase = 'plan' | 'production' | 'qc' | 'logistics';

export interface ODStep {
  seq: number;
  key: string;
  name: string;
  desc: string;
  /** 配套 MES / ERP 业务单据（用户映射，空表示无独立单据） */
  docs: string[];
  /** 横切系统提示（轻量，非主干） */
  systems: string[];
}

export interface ODBand {
  key: ODPhase;
  label: string;
  steps: ODStep[];
}

export const OD_BANDS: ODBand[] = [
  {
    key: 'plan',
    label: '接单与备料',
    steps: [
      {
        seq: 1,
        key: 'cust-order',
        name: '客户下单',
        desc: '客户下达采购需求，生成销售订单。',
        docs: ['销售订单'],
        systems: ['销售', 'CRM'],
      },
      {
        seq: 2,
        key: 'order-review',
        name: '订单审核',
        desc: '业务评审交期、价格与物料齐套性，确认订单生效。',
        docs: [],
        systems: ['销售', '计划'],
      },
      {
        seq: 3,
        key: 'mrp',
        name: '物料需求计划',
        desc: '核算库存，算出需要采购、自制生产的数量（MRP 运算）。',
        docs: [],
        systems: ['ERP', '物料'],
      },
      {
        seq: 4,
        key: 'purchase',
        name: '采购下单',
        desc: '向供应商下达采购订单。',
        docs: ['采购订单'],
        systems: ['ERP', '采购', 'SRM'],
      },
      {
        seq: 5,
        key: 'supplier-deliver',
        name: '供应商送货',
        desc: '原材料送达工厂。',
        docs: ['送货单（供应商）'],
        systems: ['SRM', '物流'],
      },
      {
        seq: 6,
        key: 'iqc',
        name: 'IQC 来料检验',
        desc: '原材料入库前检验，不良物料拒收。',
        docs: ['来料检验单'],
        systems: ['QMS'],
      },
      {
        seq: 7,
        key: 'mat-in',
        name: '原料入库',
        desc: '检验合格原材料存入原料仓库。',
        docs: ['原料入库单'],
        systems: ['WMS'],
      },
    ],
  },
  {
    key: 'production',
    label: '生产执行',
    steps: [
      {
        seq: 8,
        key: 'picking',
        name: '生产领料 / 配料',
        desc: '车间根据工单领取原材料。',
        docs: ['领料单'],
        systems: ['WMS'],
      },
      {
        seq: 9,
        key: 'shopfloor',
        name: '车间生产加工',
        desc: '按生产工单加工制造，生成生产报工记录。厂内细分为下料 → 机加工 → 组装 → 检验四道工序。',
        docs: ['生产工单', '生产报工记录'],
        systems: ['MES'],
      },
      {
        seq: 10,
        key: 'ipqc',
        name: 'IPQC 制程巡检',
        desc: '生产过程中巡回抽检，及时发现生产异常。',
        docs: ['制程巡检单'],
        systems: ['QMS', 'MES'],
      },
    ],
  },
  {
    key: 'qc',
    label: '质检与包装',
    steps: [
      {
        seq: 11,
        key: 'fqc',
        name: 'FQC 成品检验',
        desc: '产品加工完成后全项成品检测。',
        docs: ['成品检验单'],
        systems: ['QMS'],
      },
      {
        seq: 12,
        key: 'packing',
        name: '产品包装',
        desc: '检验合格产品进行包装。',
        docs: [],
        systems: ['MES', 'QMS'],
      },
    ],
  },
  {
    key: 'logistics',
    label: '入库与交付',
    steps: [
      {
        seq: 13,
        key: 'prod-in',
        name: '成品入库',
        desc: '包装完成后存入成品仓库。',
        docs: ['成品入库单'],
        systems: ['WMS'],
      },
      {
        seq: 14,
        key: 'ship-instruct',
        name: '收到发货指令',
        desc: '根据客户需求安排出货。',
        docs: ['发货通知单'],
        systems: ['销售', 'ERP'],
      },
      {
        seq: 15,
        key: 'oqc',
        name: 'OQC 出货检验',
        desc: '发货前再次抽检，防止不良品流出。',
        docs: ['出货检验单'],
        systems: ['QMS'],
      },
      {
        seq: 16,
        key: 'ship-out',
        name: '发货出库',
        desc: '货物装车，交付客户。',
        docs: ['出库单', '送货单'],
        systems: ['WMS', '物流'],
      },
    ],
  },
];
