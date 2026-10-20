import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAction, useMe, useUsers } from '../features/api';
import { api, type User } from '../lib/api';
import { Confirm, ErrorState, Loading, Empty, StatusBadge } from '../components/shared';
export function Users() {
  const [params, setParams] = useSearchParams();
  const users = useUsers(params.toString());
  const me = useMe();
  const [change, setChange] = useState<{
    user: User;
    input: { role?: string; isActive?: boolean };
  } | null>(null);
  const mutation = useAction(
    (value: NonNullable<typeof change>) =>
      api(`/users/${value.user.id}`, { method: 'PATCH', body: JSON.stringify(value.input) }),
    'Account updated',
  );
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.set('page', '1');
    setParams(next);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE PROGRESS</span>
          <h1>Workspace members</h1>
          <p>Manage access and keep your team connected.</p>
        </div>
      </div>
      <section className="panel">
        <div className="filters">
          <input
            aria-label="Search members"
            placeholder="Search name or email…"
            value={params.get('search') ?? ''}
            onChange={(e) => filter('search', e.target.value)}
          />
          <select
            aria-label="Filter role"
            value={params.get('role') ?? ''}
            onChange={(e) => filter('role', e.target.value)}
          >
            <option value="">All roles</option>
            <option>USER</option>
            <option>ADMIN</option>
          </select>
          <select
            aria-label="Filter active state"
            value={params.get('isActive') ?? ''}
            onChange={(e) => filter('isActive', e.target.value)}
          >
            <option value="">All accounts</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {users.isPending ? (
          <Loading />
        ) : users.error ? (
          <ErrorState error={users.error} retry={() => users.refetch()} />
        ) : !users.data.data.length ? (
          <Empty>
            <h3>No matching members</h3>
            <p>Try another search or filter.</p>
          </Empty>
        ) : (
          <div className="members">
            {users.data.data.map((user) => (
              <div className="member" key={user.id}>
                <div className="avatar">{user.name.slice(0, 1)}</div>
                <div className="member-name">
                  <strong>
                    {user.name}
                    {user.id === me.data?.data.id ? ' (you)' : ''}
                  </strong>
                  <small>{user.email}</small>
                </div>
                <StatusBadge status={user.isActive ? 'ACTIVE' : 'INACTIVE'} />
                <select
                  aria-label={`Role for ${user.name}`}
                  value={user.role}
                  disabled={user.id === me.data?.data.id}
                  onChange={(e) => setChange({ user, input: { role: e.target.value } })}
                >
                  <option>USER</option>
                  <option>ADMIN</option>
                </select>
                <button
                  className="secondary compact"
                  disabled={user.id === me.data?.data.id}
                  onClick={() => setChange({ user, input: { isActive: !user.isActive } })}
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}
        {users.data && (
          <div className="pagination">
            <span>
              {users.data.meta.total} members · Page {users.data.meta.page}
            </span>
            <div>
              <button
                className="secondary compact"
                disabled={!users.data.meta.hasPrevPage}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(users.data.meta.page - 1));
                  setParams(next);
                }}
              >
                Previous
              </button>
              <button
                className="secondary compact"
                disabled={!users.data.meta.hasNextPage}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(users.data.meta.page + 1));
                  setParams(next);
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      {change && (
        <Confirm
          title={`Update ${change.user.name}?`}
          pending={mutation.isPending}
          onClose={() => setChange(null)}
          onConfirm={() => mutation.mutate(change, { onSuccess: () => setChange(null) })}
        >
          {change.input.role
            ? `Their new role will be ${change.input.role}.`
            : change.input.isActive
              ? 'They will be able to sign in again.'
              : 'Their sessions will end immediately and sign-in will be disabled.'}
        </Confirm>
      )}
    </>
  );
}
