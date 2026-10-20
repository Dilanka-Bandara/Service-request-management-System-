import type { ReactNode } from 'react';
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span aria-hidden="true">●</span> {label(status)}
    </span>
  );
}
export function Loading() {
  return (
    <div role="status" aria-label="Loading" className="skeleton">
      <div />
      <div />
      <div />
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="empty" role="alert">
      <h3>We couldn’t load this</h3>
      <p>{error.message}</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">↗</div>
      {children}
    </div>
  );
}
export function Field({
  label: text,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{text}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
export function Confirm({
  title,
  children,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="modal"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !pending) onClose();
          if (e.key === 'Tab') {
            const buttons =
              e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{children}</p>
        <div className="actions">
          <button autoFocus className="secondary" disabled={pending} onClick={onClose}>
            Keep as is
          </button>
          <button disabled={pending} onClick={onConfirm}>
            {pending ? 'Saving…' : 'Confirm change'}
          </button>
        </div>
      </section>
    </div>
  );
}
