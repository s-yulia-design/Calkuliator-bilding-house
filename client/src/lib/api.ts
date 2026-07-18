import type { CatalogItem, PriceSettings, Project, ProjectSummary } from '@shared/types';
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

  updateProject: (
    id: string,
    body: Partial<
      Pick<Project, 'name' | 'areaM2' | 'deliveryCost' | 'deliveryIncluded' | 'reservePercent'>
    >,
  ) => wrap(() => store.updateProject(id, body)),

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

  createCatalogItem: (body: Partial<CatalogItem>) => wrap(() => store.createCatalogItem(body)),

  updateCatalogItem: (id: string, body: Partial<CatalogItem>) =>
    wrap(() => {
      store.updateCatalogItem(id, body);
      return { ok: true as const };
    }),

  deleteCatalogItem: (id: string) =>
    wrap(() => {
      store.deleteCatalogItem(id);
      return { ok: true as const };
    }),

  templates: () => wrap(() => store.templates()),

  getTemplate: (id: string) => wrap(() => store.getTemplate(id) as TemplateFull),

  updateTemplateItem: (templateId: string, itemId: string, body: Record<string, unknown>) =>
    wrap(() => {
      store.updateTemplateItem(templateId, itemId, body);
      return { ok: true as const };
    }),

  getSettings: () => wrap(() => store.getSettings()),

  updateSettings: (body: Partial<PriceSettings>) => wrap(() => store.updateSettings(body)),
};

export type { Project, ProjectSummary };
