// @vitest-environment jsdom
import React from 'react';
import { expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusBadge } from './shared';
import { formSchema } from '../pages/RequestForm';
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
