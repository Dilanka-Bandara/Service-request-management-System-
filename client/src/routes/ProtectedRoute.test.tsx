// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ApiError } from '../lib/api';
const session = vi.hoisted(() => vi.fn());
vi.mock('../features/api', () => ({ useMe: session }));
afterEach(cleanup);
it('redirects logged-out visitors to sign in', async () => {
  session.mockReturnValue({
    isPending: false,
    error: new ApiError(401, 'UNAUTHENTICATED', 'Sign in'),
  });
  render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<h1>Private content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText('Private content')).toBeNull();
});
it('redirects members away from administrator pages', async () => {
  session.mockReturnValue({ isPending: false, error: null, data: { data: { role: 'USER' } } });
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/dashboard" element={<h1>Member dashboard</h1>} />
        <Route element={<ProtectedRoute admin />}>
          <Route path="/admin" element={<h1>Admin content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Member dashboard' })).toBeTruthy();
});
