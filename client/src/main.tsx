import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { LayoutDashboard, Users as UsersIcon, Moon, Sun, LogOut, Menu, Plus } from 'lucide-react';
import { useMe } from './features/api';
import { api } from './lib/api';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { RequestForm } from './pages/RequestForm';
import { RequestDetail } from './pages/RequestDetail';
import { Users } from './pages/Users';
import { ProtectedRoute } from './routes/ProtectedRoute';
import './styles.css';
function Layout() {
  const me = useMe();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [logoutError, setLogoutError] = useState('');
  return (
    <div className={`workspace ${dark ? 'dark' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link className="brand" to="/dashboard">
          <span className="brand-mark">r.</span>resolve<span className="brand-dot">●</span>
        </Link>
        <span className="nav-label">WORKSPACE</span>
        <nav onClick={() => setOpen(false)}>
          <NavLink to="/dashboard">
            <LayoutDashboard size={19} /> Overview
          </NavLink>
          <NavLink to="/requests/new">
            <Plus size={19} /> New request
          </NavLink>
          {me.data?.data.role === 'ADMIN' && (
            <NavLink to="/admin/users">
              <UsersIcon size={19} /> Members
            </NavLink>
          )}
        </nav>
        <div className="sidebar-note">
          <span>Built for moving forward.</span>
          <p>
            A home for questions.
            <br />A path to answers.
          </p>
          <span className="note-arrow">↗</span>
        </div>
        <div className="sidebar-bottom">
          <button
            className="theme-toggle"
            onClick={() => {
              setDark(!dark);
              localStorage.setItem('theme', dark ? 'light' : 'dark');
            }}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />} {dark ? 'Light' : 'Dark'} appearance
          </button>
          <span className="version">RESOLVE WORKSPACE / V1.0</span>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu secondary compact"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Menu size={20} />
            </button>
            <span>
              Workspace <span className="breadcrumb-slash">/</span>{' '}
              <strong>
                {me.data?.data.role === 'ADMIN' ? 'Administration' : 'Service requests'}
              </strong>
            </span>
          </div>
          <div className="topbar-user">
            <span className="role-label">
              {me.data?.data.role === 'ADMIN' ? 'Administrator' : 'Member'}
            </span>
            <span className="avatar">{me.data?.data.name.slice(0, 1)}</span>
            <span>{me.data?.data.name}</span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api('/auth/logout', { method: 'POST', body: '{}' });
                  cache.clear();
                  navigate('/login');
                } catch {
                  setLogoutError('Unable to sign out. Please try again.');
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {logoutError && <p role="alert">{logoutError}</p>}
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
const cache = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={cache}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/requests/new" element={<RequestForm />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/requests/:id/edit" element={<RequestForm />} />
              <Route element={<ProtectedRoute admin />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/admin/requests" element={<Dashboard />} />
                <Route path="/admin/users" element={<Users />} />
              </Route>
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Page not found</h1>
                <Link to="/dashboard">Back to workspace</Link>
              </div>
            }
          />
        </Routes>
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
