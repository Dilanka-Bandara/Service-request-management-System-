import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, type List, type User, type ServiceRequest, type Stats } from '../lib/api';
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ data: User }>('/auth/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
    staleTime: 60000,
  });
export const useRequests = (search: string) =>
  useQuery({
    queryKey: ['requests', search],
    queryFn: () => api<List<ServiceRequest>>(`/requests?${search}`),
  });
export const useRequest = (id: string) =>
  useQuery({
    queryKey: ['request', id],
    queryFn: () => api<{ data: ServiceRequest }>(`/requests/${id}`),
    enabled: !!id,
  });
export const useStats = () =>
  useQuery({ queryKey: ['stats'], queryFn: () => api<{ data: Stats }>('/requests/stats') });
export const useUsers = (search: string) =>
  useQuery({ queryKey: ['users', search], queryFn: () => api<List<User>>(`/users?${search}`) });
export function useAction<T, V>(action: (input: V) => Promise<T>, message: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await Promise.all(
        ['requests', 'request', 'stats', 'users'].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(message);
    },
    onError: (error) => toast.error(error.message),
  });
}
