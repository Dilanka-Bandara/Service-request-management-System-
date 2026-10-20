import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMe, useRequests, useStats } from '../features/api';
import { Empty, ErrorState, Loading, StatusBadge, label } from '../components/shared';
export const statuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
export const categories = ['TECHNICAL', 'BILLING', 'ACCOUNT', 'OTHER'];
export const priorities = ['LOW', 'MEDIUM', 'HIGH'];
export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const stats = useStats();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const requests = useRequests(params.toString());
  useEffect(() => {
    setSearch(params.get('search') ?? '');
  }, [params]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (params.get('search') ?? ''))
        setParams((previous) => {
          const next = new URLSearchParams(previous);
          search ? next.set('search', search) : next.delete('search');
          next.set('page', '1');
          return next;
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, params, setParams]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.set('page', '1');
    setParams(next);
  }
  const admin = me.data?.data.role === 'ADMIN';
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h1>{admin ? 'Workspace overview' : 'Your requests, in focus.'}</h1>
          <p>
            {admin
              ? 'Keep your team’s requests moving in the right direction.'
              : `Welcome back, ${me.data?.data.name.split(' ')[0] ?? ''}. Let’s move things forward.`}
          </p>
        </div>
        <Link className="button" to="/requests/new">
          <Plus size={17} /> New request
        </Link>
      </div>
      {stats.isPending ? (
        <Loading />
      ) : stats.error ? (
        <ErrorState error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <div className="stats-grid">
          {statuses.map((status, i) => (
            <div className={`stat stat-${i}`} key={status}>
              <div>
                <span className="stat-label">{label(status)}</span>
                <span className="stat-symbol">{['◷', '↗', '✓', '−'][i]}</span>
              </div>
              <strong>
                {stats.data.data.byStatus.find((r) => r.status === status)?._count ?? 0}
              </strong>
              <small>
                {
                  [
                    'Waiting for a first look',
                    'Good things are underway',
                    'Another thing taken care of',
                    'Closed before completion',
                  ][i]
                }
              </small>
            </div>
          ))}
        </div>
      )}
      {admin && stats.data && (
        <section className="category-strip">
          <strong>Across the workspace</strong>
          {categories.map((category) => {
            const count =
              stats.data.data.byCategory.find((r) => r.category === category)?._count ?? 0;
            return (
              <div key={category}>
                <span>
                  {label(category)} <b>{count}</b>
                </span>
                <meter
                  min={0}
                  max={Math.max(stats.data.data.total, 1)}
                  value={count}
                  aria-label={`${label(category)} requests`}
                />
              </div>
            );
          })}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {admin ? 'All requests' : 'Request activity'}{' '}
              <span className="count">{requests.data?.meta.total ?? '—'}</span>
            </h2>
            <p>A clear view of everything on your list.</p>
          </div>
          <span className="subtle">
            <SlidersHorizontal size={16} /> Your workspace
          </span>
        </div>
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search requests"
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {[
            ['status', statuses],
            ['category', categories],
            ['priority', priorities],
          ].map(([key, options]) => (
            <select
              key={key as string}
              aria-label={`Filter by ${key}`}
              value={params.get(key as string) ?? ''}
              onChange={(e) => filter(key as string, e.target.value)}
            >
              <option value="">
                All{' '}
                {(key as string) === 'category'
                  ? 'categories'
                  : (key as string) === 'priority'
                    ? 'priorities'
                    : 'statuses'}
              </option>
              {(options as string[]).map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          ))}
          <select
            aria-label="Sort requests"
            value={params.get('sortBy') ?? 'createdAt'}
            onChange={(e) => filter('sortBy', e.target.value)}
          >
            <option value="createdAt">Date created</option>
            <option value="updatedAt">Last updated</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
          </select>
          <button
            className="secondary compact"
            aria-label="Reverse sort order"
            onClick={() => filter('sortOrder', params.get('sortOrder') === 'asc' ? 'desc' : 'asc')}
          >
            {params.get('sortOrder') === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
        {requests.isPending ? (
          <Loading />
        ) : requests.error ? (
          <ErrorState error={requests.error} retry={() => requests.refetch()} />
        ) : !requests.data.data.length ? (
          <Empty>
            <h3>No requests here yet</h3>
            <p>Create your first request or try different filters.</p>
            <Link className="button" to="/requests/new">
              Create a request
            </Link>
          </Empty>
        ) : (
          <>
            <div className="request-table">
              <div className="table-head">
                <span>REQUEST</span>
                <span>CATEGORY</span>
                <span>PRIORITY</span>
                <span>STATUS</span>
                <span>CREATED</span>
                <span />
              </div>
              {requests.data.data.map((request) => (
                <Link to={`/requests/${request.id}`} className="request-row" key={request.id}>
                  <div className="request-title">
                    <span className="request-id">REQ–{request.id.slice(0, 6).toUpperCase()}</span>
                    <strong>{request.title}</strong>
                    {admin && <small>{request.createdBy.name}</small>}
                  </div>
                  <span className="category">{label(request.category)}</span>
                  <span className={`priority ${request.priority.toLowerCase()}`}>
                    ▰ {label(request.priority)}
                  </span>
                  <StatusBadge status={request.status} />
                  <span className="date">
                    {new Date(request.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
            <footer className="pagination">
              <span>
                {requests.data.meta.total} requests · Page {requests.data.meta.page} of{' '}
                {requests.data.meta.totalPages}
              </span>
              <div>
                <select
                  aria-label="Requests per page"
                  value={params.get('limit') ?? '10'}
                  onChange={(e) => filter('limit', e.target.value)}
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
                <button
                  className="secondary compact"
                  disabled={!requests.data.meta.hasPrevPage}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(requests.data.meta.page - 1));
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <button
                  className="secondary compact"
                  disabled={!requests.data.meta.hasNextPage}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(requests.data.meta.page + 1));
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
      <p className="page-footnote">
        <span className="live-dot" /> A little more organized. A little less on your mind.
      </p>
    </>
  );
}
