import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { api, ApiError, type ServiceRequest } from '../lib/api';
import { useAction, useRequest } from '../features/api';
import { Field, Loading, ErrorState, label } from '../components/shared';
import { categories, priorities } from './Dashboard';
export const formSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Add at least 10 characters of detail').max(10000),
  category: z.enum(['TECHNICAL', 'BILLING', 'ACCOUNT', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
type Values = z.infer<typeof formSchema>;
export function RequestForm() {
  const { id = '' } = useParams();
  const request = useRequest(id);
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', description: '', category: 'TECHNICAL', priority: 'MEDIUM' },
  });
  useEffect(() => {
    if (request.data) form.reset(request.data.data as Values);
  }, [request.data, form]);
  const save = useAction(
    (values: Values) =>
      api<{ data: ServiceRequest }>(id ? `/requests/${id}` : '/requests', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      }),
    id ? 'Request updated' : 'Request created',
  );
  if (id && request.isPending) return <Loading />;
  if (id && request.error)
    return <ErrorState error={request.error} retry={() => request.refetch()} />;
  if (id && !request.data?.data.allowedActions.canEdit)
    return (
      <div className="panel empty">
        <h2>This request is no longer editable</h2>
        <Link to={`/requests/${id}`}>Return to request</Link>
      </div>
    );
  return (
    <>
      <Link className="back-link" to={id ? `/requests/${id}` : '/dashboard'}>
        ← Back to workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S GET IT SORTED</span>
          <h1>{id ? 'A few more details.' : 'How can we help?'}</h1>
          <p>Tell us what you need. We’ll take it from here.</p>
        </div>
      </div>
      <form
        className="panel request-form"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const result = await save.mutateAsync(values);
            navigate(`/requests/${result.data.id}`);
          } catch (error) {
            if (error instanceof ApiError)
              for (const detail of error.details)
                if (detail.field in values)
                  form.setError(detail.field as keyof Values, { message: detail.message });
          }
        })}
      >
        <Field label="Request title" error={form.formState.errors.title?.message}>
          <input placeholder="A short, clear summary" {...form.register('title')} />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select {...form.register('category')}>
              {categories.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select {...form.register('priority')}>
              {priorities.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What’s happening?" error={form.formState.errors.description?.message}>
          <textarea
            rows={7}
            placeholder="Include any details that will help us understand your request…"
            {...form.register('description')}
          />
        </Field>
        <div className="info-note">
          You can attach PDFs and images after creating your request. Each request keeps its own
          activity history.
        </div>
        {save.error && (
          <p role="alert" className="form-error">
            {save.error.message}
          </p>
        )}
        <div className="form-footer">
          <Link to={id ? `/requests/${id}` : '/dashboard'}>Cancel</Link>
          <button disabled={save.isPending}>
            {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Submit request →'}
          </button>
        </div>
      </form>
    </>
  );
}
