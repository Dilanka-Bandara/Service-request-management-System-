export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFile = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(!isFile ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: { code: 'NETWORK_ERROR', message: 'The server could not complete your request' },
    }));
    throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
};
export type ServiceRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  allowedActions: { canEdit: boolean; canCancel: boolean; nextStatuses: string[] };
  history: {
    id: string;
    action: string;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
    actor: { name: string };
  }[];
  attachments: { id: string; name: string; size: number }[];
};
export type List<T> = {
  data: T[];
  meta: {
    page: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};
export type Stats = {
  total: number;
  byStatus: { status: string; _count: number }[];
  byCategory: { category: string; _count: number }[];
};
