/**
 * AuthGuard：全站登录保护。
 * 未登录时跳转 /login；已登录才渲染子路由。
 * 通过 React Query 缓存 whoami 结果，避免每次路由切换都发请求。
 */
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { LoadingState } from './StateBlock';
import { bootstrapUserData } from '../lib/userData';

export function useAuth() {
  return useQuery({
    queryKey: ['whoami'],
    queryFn: api.whoami,
    // 冷启动 / D1 慢查询偶发超时不能把已登录用户踢回登录页，retry 2 次覆盖瞬时抖动。
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 5 * 60 * 1000,
  });
}

/** 清除 whoami 缓存，触发 RequireAuth 重定向到 /login */
export function useLogout() {
  const qc = useQueryClient();
  return {
    logout: async () => {
      try {
        await api.logout();
      } finally {
        qc.setQueryData(['whoami'], null);
        qc.invalidateQueries({ queryKey: ['whoami'] });
      }
    },
  };
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isError, data } = useAuth();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (data?.sub) {
      // 登录确认后先把跨设备数据（作品集/昵称/引擎状态/仿真状态）从云端拉到本地镜像，
      // 并做一次本地→云端迁移；带超时兜底，绝不长期阻塞首屏。
      bootstrapUserData().finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  }, [data?.sub]);

  if (isLoading) return <LoadingState label="验证身份…" />;
  if (isError || !data?.sub) return <Navigate to="/login" replace />;
  if (booting) return <LoadingState label="同步数据…" />;

  return <>{children}</>;
}
