import { useQuery } from '@tanstack/react-query';
import { api, type DictBundle, type DictType, type DictData } from '../api/endpoints';

/**
 * 名称翻译 / 专业词典客户端缓存与分组工具（借鉴 RuoYi 字典管理思路）。
 *
 * - useDict()：一次拉全量词典（类型 + 数据），TanStack Query 缓存 5 分钟，
 *   供「名称翻译」页的词表与选中翻译复用，避免重复请求、实现前端缓存。
 * - groupByType()：把扁平 data 按 type_key 归到对应类型下，供词表 chips 渲染。
 */

export interface DictGroup {
  type: DictType;
  items: DictData[];
}

/** 全量词典（TanStack Query）。 */
export function useDict() {
  return useQuery({
    queryKey: ['dict'],
    queryFn: api.dictGet,
    staleTime: 5 * 60 * 1000,
  });
}

/** 把扁平 data 按 type_key 分组到对应类型下，类型与词条均按 sort 升序。 */
export function groupByType(bundle: DictBundle | undefined): DictGroup[] {
  if (!bundle) return [];
  const byKey = new Map<string, DictData[]>();
  for (const d of bundle.data) {
    const arr = byKey.get(d.typeKey) ?? [];
    arr.push(d);
    byKey.set(d.typeKey, arr);
  }
  return bundle.types
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((t) => ({
      type: t,
      items: (byKey.get(t.typeKey) ?? []).slice().sort((a, b) => a.sort - b.sort),
    }));
}
