import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type User } from '../lib/api';
import { Field } from '../components/shared';
import { toast } from 'sonner';
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
export function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(
      register
        ? schema.extend({
            name: z.string().trim().min(2),
            password: z
              .string()
              .min(8)
              .max(72)
              .regex(/[A-Za-z]/, 'Include a letter')
              .regex(/\d/, 'Include a number'),
          })
        : schema,
    ),
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      api<{ data: User }>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      cache.clear();
      cache.setQueryData(['me'], data);
      toast.success(register ? 'Your workspace is ready' : 'Welcome back');
      navigate('/dashboard');
    },
    onError: (error) => {
      if (error instanceof ApiError)
        for (const detail of error.details)
          if (['name', 'email', 'password'].includes(detail.field))
            form.setError(detail.field as 'name' | 'email' | 'password', {
              message: detail.message,
            });
    },
  });
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link className="brand" to="/">
          <span className="brand-mark">r.</span>resolve<span className="brand-dot">●</span>
        </Link>
        <div>
          <span className="eyebrow">A LITTLE CLARITY. A LOT OF PROGRESS.</span>
          <h1>
            Good work starts
            <br />
            with a clear request.
          </h1>
          <p>
            One space to ask for help, follow the progress,
            <br />
            and get back to what matters.
          </p>
          <div className="story-card">
            <span className="story-check">✓</span>
            <div>
              <strong>Every request, accounted for.</strong>
              <p>From the first question to the final resolution.</p>
            </div>
          </div>
        </div>
        <small>SERVICE REQUEST WORKSPACE · 2026</small>
      </aside>
      <main className="auth-form">
        <span className="eyebrow">YOUR WORKSPACE, CONNECTED</span>
        <h2>{register ? 'Make yourself at home.' : 'Welcome back.'}</h2>
        <p>
          {register
            ? 'Create an account to submit and track requests.'
            : 'Sign in to see what’s moving forward.'}
        </p>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          {register && (
            <Field label="Full name" error={form.formState.errors.name?.message}>
              <input autoComplete="name" {...form.register('name')} />
            </Field>
          )}
          <Field label="Email address" error={form.formState.errors.email?.message}>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...form.register('email')}
            />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <input
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              {...form.register('password')}
            />
          </Field>
          {register && <small>8–72 characters, including a letter and a number.</small>}
          {mutation.error && (
            <p className="form-error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <button className="wide" disabled={mutation.isPending}>
            {mutation.isPending ? 'Please wait…' : register ? 'Create account →' : 'Sign in →'}
          </button>
        </form>
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New to Resolve?'}{' '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </main>
    </div>
  );
}
