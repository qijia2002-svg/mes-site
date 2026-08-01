/**
 * AuthGuard：全站登录保护。
 * 未登录时跳转 /login；已登录才渲染子路由。
 * 通过 React Query 缓存 whoami 结果，避免每次路由切换都发请求。
 */
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { LoadingState } from './StateBlock';

export function useAuth() {
  return useQuery({
    queryKey: ['whoami'],
    queryFn: api.whoami,
    retry: 0,
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

  if (isLoading) return <LoadingState label="验证身份…" />;
  if (isError || !data?.sub) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
