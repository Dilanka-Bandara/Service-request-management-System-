import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Paperclip, Download } from 'lucide-react';
import { useAction, useRequest } from '../features/api';
import { api } from '../lib/api';
import { Confirm, ErrorState, Field, Loading, StatusBadge, label } from '../components/shared';
export function RequestDetail() {
  const { id = '' } = useParams();
  const query = useRequest(id);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'cancel' | 'status' | null>(null);
  const change = useAction(
    (action: 'cancel' | 'status') =>
      api(`/requests/${id}${action === 'status' ? '/status' : ''}`, {
        method: action === 'cancel' ? 'DELETE' : 'PATCH',
        body: JSON.stringify(action === 'cancel' ? {} : { status, note }),
      }),
    'Request updated',
  );
  const upload = useAction((file: File) => {
    const body = new FormData();
    body.append('file', file);
    return api(`/requests/${id}/attachments`, { method: 'POST', body });
  }, 'Attachment added');
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const request = query.data!.data;
  return (
    <>
      <Link className="back-link" to="/dashboard">
        ← All requests
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REQ–{id.slice(0, 6).toUpperCase()}</span>
          <h1>{request.title}</h1>
          <p>
            Opened by {request.createdBy.name} · {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel detail-panel">
            <div className="detail-tags">
              <span>{label(request.category)}</span>
              <span className={`priority ${request.priority.toLowerCase()}`}>
                {label(request.priority)} priority
              </span>
            </div>
            <h2>The details</h2>
            <p className="description">{request.description}</p>
            <div className="actions">
              {request.allowedActions.canEdit && (
                <Link className="button secondary" to={`/requests/${id}/edit`}>
                  Edit request
                </Link>
              )}
              {request.allowedActions.canCancel && (
                <button className="danger secondary" onClick={() => setConfirm('cancel')}>
                  Cancel request
                </button>
              )}
            </div>
          </section>
          <section className="panel detail-panel">
            <h2>
              <Paperclip size={18} /> Attachments{' '}
              <span className="count">{request.attachments.length}</span>
            </h2>
            {request.attachments.length ? (
              request.attachments.map((file) => (
                <a
                  className="attachment"
                  key={file.id}
                  href={`/api/requests/${id}/attachments/${file.id}`}
                >
                  <span>
                    {file.name}
                    <small>{(file.size / 1024).toFixed(1)} KB</small>
                  </span>
                  <Download size={18} />
                </a>
              ))
            ) : (
              <p>No files attached yet.</p>
            )}
            {request.allowedActions.canEdit && request.attachments.length < 5 && (
              <Field
                label={
                  upload.isPending ? 'Uploading…' : 'Add a file · PDF, PNG or JPEG · up to 5 MiB'
                }
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={upload.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate(file);
                    e.target.value = '';
                  }}
                />
              </Field>
            )}
          </section>
          {!!request.allowedActions.nextStatuses.length && (
            <section className="panel detail-panel">
              <h2>Move this forward</h2>
              <Field label="Next status">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Choose a status</option>
                  {request.allowedActions.nextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note (optional)">
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Give the requester a little context"
                />
              </Field>
              <button
                disabled={!request.allowedActions.nextStatuses.includes(status)}
                onClick={() => setConfirm('status')}
              >
                Update status
              </button>
            </section>
          )}
        </div>
        <aside className="panel timeline">
          <span className="eyebrow">EVERY STEP, IN ONE PLACE</span>
          <h2>Activity timeline</h2>
          {request.history.map((item) => (
            <div className="timeline-item" key={item.id}>
              <span className="timeline-dot" />
              <strong>
                {label(item.action)}
                {item.toStatus ? ` · ${label(item.toStatus)}` : ''}
              </strong>
              <p>{item.actor.name}</p>
              {item.note && <blockquote>{item.note}</blockquote>}
              <time>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
          ))}
        </aside>
      </div>
      {confirm && (
        <Confirm
          title={confirm === 'cancel' ? 'Cancel this request?' : `Move to ${label(status)}?`}
          pending={change.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            change.mutate(confirm, {
              onSuccess: () => {
                setConfirm(null);
                setStatus('');
                setNote('');
              },
            })
          }
        >
          {confirm === 'cancel'
            ? 'This closes the request permanently. Its details and history will remain available.'
            : 'The requester will receive an email update when notification delivery is configured.'}
        </Confirm>
      )}
    </>
  );
}
