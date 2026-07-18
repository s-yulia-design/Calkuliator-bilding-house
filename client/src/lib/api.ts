import type { CatalogItem, Project, ProjectSummary } from '@shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Ошибка запроса');
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  listProjects: () => request<ProjectSummary[]>('/api/projects'),

  createProject: (body: { name?: string; templateId?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),

  getProject: (id: string) => request<Project>(`/api/projects/${id}`),

  renameProject: (id: string, name: string) =>
    request<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  addStage: (id: string, name: string) =>
    request<Project>(`/api/projects/${id}/stages`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameStage: (id: string, stageId: string, name: string) =>
    request<Project>(`/api/projects/${id}/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteStage: (id: string, stageId: string) =>
    request<Project>(`/api/projects/${id}/stages/${stageId}`, { method: 'DELETE' }),

  addItem: (id: string, stageId: string, body: Record<string, unknown>) =>
    request<Project>(`/api/projects/${id}/stages/${stageId}/items`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    request<Project>(`/api/projects/${id}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteItem: (id: string, itemId: string) =>
    request<Project>(`/api/projects/${id}/items/${itemId}`, { method: 'DELETE' }),

  catalog: () => request<CatalogItem[]>('/api/catalog'),

  createCatalogItem: (body: Partial<CatalogItem>) =>
    request<{ id: string }>('/api/catalog', { method: 'POST', body: JSON.stringify(body) }),

  updateCatalogItem: (id: string, body: Partial<CatalogItem>) =>
    request<{ ok: boolean }>(`/api/catalog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteCatalogItem: (id: string) =>
    request<{ ok: boolean }>(`/api/catalog/${id}`, { method: 'DELETE' }),

  templates: () =>
    request<Array<{ id: string; name: string; description: string }>>('/api/templates'),

  getTemplate: (id: string) => request(`/api/templates/${id}`),

  updateTemplateItem: (templateId: string, itemId: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/templates/${templateId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminMe: () => request<{ admin: boolean }>('/api/admin/me'),

  adminLogin: (password: string) =>
    request<{ ok: boolean }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminLogout: () => request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),

  adminProjects: () => request<ProjectSummary[]>('/api/admin/projects'),
};
