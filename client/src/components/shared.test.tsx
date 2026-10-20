// @vitest-environment jsdom
import React from 'react';
import { expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StatusBadge } from './shared';
import { formSchema, RequestForm } from '../pages/RequestForm';
afterEach(cleanup);
it('renders status as accessible text, not just a color', () => {
  render(<StatusBadge status="IN_PROGRESS" />);
  expect(screen.getByText('In progress')).toBeTruthy();
});
it('rejects an incomplete request and accepts actionable details', () => {
  expect(
    formSchema.safeParse({
      title: 'a',
      description: 'short',
      category: 'TECHNICAL',
      priority: 'HIGH',
    }).success,
  ).toBe(false);
  expect(
    formSchema.safeParse({
      title: 'VPN failure',
      description: 'Cannot connect to the company VPN.',
      category: 'TECHNICAL',
      priority: 'HIGH',
    }).success,
  ).toBe(true);
});
it('shows inline errors when an empty request is submitted', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RequestForm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit request →' }));
  expect(await screen.findByText('Use at least 3 characters')).toBeTruthy();
  expect(await screen.findByText('Add at least 10 characters of detail')).toBeTruthy();
});
