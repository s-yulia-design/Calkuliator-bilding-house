import type { CatalogItem, Project, ProjectSummary } from '@shared/types';
import { store, type TemplateFull } from './store';

function wrap<T>(fn: () => T): Promise<T> {
  return Promise.resolve().then(fn);
}

export const api = {
  health: () => wrap(() => ({ ok: true as const })),

  listProjects: () => wrap(() => store.listProjects()),

  createProject: (body: { name?: string; templateId?: string }) =>
    wrap(() => store.createProject(body)),

  getProject: (id: string) => wrap(() => store.getProject(id)),

  renameProject: (id: string, name: string) => wrap(() => store.renameProject(id, name)),

  deleteProject: (id: string) =>
    wrap(() => {
      store.deleteProject(id);
      return { ok: true as const };
    }),

  addStage: (id: string, name: string) => wrap(() => store.addStage(id, name)),

  renameStage: (
    id: string,
    stageId: string,
    body: { name?: string; extraMaterials?: number; extraLabor?: number; extraNote?: string },
  ) => wrap(() => store.updateStage(id, stageId, body)),

  deleteStage: (id: string, stageId: string) => wrap(() => store.deleteStage(id, stageId)),

  addItem: (id: string, stageId: string, body: Record<string, unknown>) =>
    wrap(() => store.addItem(id, stageId, body)),

  updateItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    wrap(() => store.updateItem(id, itemId, body)),

  deleteItem: (id: string, itemId: string) => wrap(() => store.deleteItem(id, itemId)),

  catalog: () => wrap(() => store.catalog()),

  createCatalogItem: (body: Partial<CatalogItem>) =>
    wrap(() => {
      store.requireAdmin();
      return store.createCatalogItem(body);
    }),

  updateCatalogItem: (id: string, body: Partial<CatalogItem>) =>
    wrap(() => {
      store.requireAdmin();
      store.updateCatalogItem(id, body);
      return { ok: true as const };
    }),

  deleteCatalogItem: (id: string) =>
    wrap(() => {
      store.requireAdmin();
      store.deleteCatalogItem(id);
      return { ok: true as const };
    }),

  templates: () => wrap(() => store.templates()),

  getTemplate: (id: string) => wrap(() => store.getTemplate(id) as TemplateFull),

  updateTemplateItem: (templateId: string, itemId: string, body: Record<string, unknown>) =>
    wrap(() => {
      store.requireAdmin();
      store.updateTemplateItem(templateId, itemId, body);
      return { ok: true as const };
    }),

  adminMe: () => wrap(() => ({ admin: store.isAdmin() })),

  adminLogin: (password: string) =>
    wrap(() => {
      store.adminLogin(password);
      return { ok: true as const };
    }),

  adminLogout: () =>
    wrap(() => {
      store.adminLogout();
      return { ok: true as const };
    }),

  adminProjects: () =>
    wrap(() => {
      store.requireAdmin();
      return store.listProjects() as ProjectSummary[];
    }),
};

export type { Project, ProjectSummary };
