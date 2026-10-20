import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/api';
import { ApiError } from '../lib/api';
import { ErrorState, Loading } from '../components/shared';
export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (me.error)
    return me.error instanceof ApiError && me.error.status === 401 ? (
      <Navigate to="/login" replace />
    ) : (
      <ErrorState error={me.error} retry={() => me.refetch()} />
    );
  if (admin && me.data?.data.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
