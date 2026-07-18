import type { CatalogItem, LineItem, Project, ProjectSummary, Stage } from '@shared/types';
import { projectTotals } from '@shared/types';
import { defaultCatalog, nigmetovaTemplate } from '@shared/seed-data';

const STORAGE_KEY = 'calc_izh_v3';
const ADMIN_KEY = 'calc_izh_admin';
const ADMIN_PASSWORD = 'admin123';

export type TemplateFull = {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      unit: string;
      qty: number;
      materialPrice: number;
      laborPrice: number;
      note: string;
      sortOrder: number;
    }>;
  }>;
};

type Db = {
  projects: Project[];
  catalog: CatalogItem[];
  templates: TemplateFull[];
};

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function now(): string {
  return new Date().toISOString();
}

function buildDefaultTemplate(): TemplateFull {
  return {
    id: nigmetovaTemplate.id,
    name: nigmetovaTemplate.name,
    description: nigmetovaTemplate.description ?? '',
    stages: nigmetovaTemplate.stages.map((stage, si) => ({
      id: uid(),
      name: stage.name,
      sortOrder: si,
      items: stage.items.map((item, ii) => ({
        id: uid(),
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        materialPrice: 0,
        laborPrice: 0,
        note: item.note ?? '',
        sortOrder: ii,
      })),
    })),
  };
}

function buildDefaultCatalog(): CatalogItem[] {
  return defaultCatalog.map((c) => ({
    id: uid(),
    name: c.name,
    unit: c.unit,
    materialPrice: c.materialPrice,
    laborPrice: c.laborPrice,
    note: c.note ?? '',
  }));
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.projects && parsed.catalog && parsed.templates) {
        ensureEngineering(parsed);
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const db: Db = {
    projects: [],
    catalog: buildDefaultCatalog(),
    templates: [buildDefaultTemplate()],
  };
  save(db);
  return db;
}

function ensureEngineering(db: Db) {
  const name = 'Инженерные системы и отделка';
  const seed = nigmetovaTemplate.stages.find((s) => s.name === name);
  if (!seed) return;

  for (const tpl of db.templates) {
    if (tpl.stages.some((s) => s.name === name)) continue;
    tpl.stages.push({
      id: uid(),
      name,
      sortOrder: tpl.stages.length,
      items: seed.items.map((item, ii) => ({
        id: uid(),
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        materialPrice: 0,
        laborPrice: 0,
        note: item.note ?? '',
        sortOrder: ii,
      })),
    });
  }

  for (const project of db.projects) {
    if (project.stages.some((s) => s.name === name)) continue;
    project.stages.push({
      id: uid(),
      projectId: project.id,
      name,
      sortOrder: project.stages.length,
      items: seed.items.map((item, ii) => ({
        id: uid(),
        stageId: '',
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        materialPrice: 0,
        laborPrice: 0,
        note: item.note ?? '',
        sortOrder: ii,
      })),
      extraMaterials: 0,
      extraLabor: 0,
      extraNote: '',
    });
    const stage = project.stages[project.stages.length - 1];
    for (const item of stage.items) item.stageId = stage.id;
  }
}

function save(db: Db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function touch(project: Project) {
  project.updatedAt = now();
}

function findProject(db: Db, id: string): Project {
  const p = db.projects.find((x) => x.id === id);
  if (!p) throw new Error('Проект не найден');
  return p;
}

function summary(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    stageCount: p.stages.length,
    totals: projectTotals(p.stages),
  };
}

function cloneFromTemplate(tpl: TemplateFull, name?: string): Project {
  const id = uid();
  const created = now();
  const stages: Stage[] = tpl.stages.map((s, si) => {
    const stageId = uid();
    const items: LineItem[] = s.items.map((item, ii) => ({
      id: uid(),
      stageId,
      name: item.name,
      unit: item.unit,
      qty: item.qty,
      materialPrice: item.materialPrice,
      laborPrice: item.laborPrice,
      note: item.note || '',
      sortOrder: ii,
    }));
    return {
      id: stageId,
      projectId: id,
      name: s.name,
      sortOrder: si,
      items,
      extraMaterials: 0,
      extraLabor: 0,
      extraNote: '',
    };
  });
  return {
    id,
    name: name || tpl.name,
    createdAt: created,
    updatedAt: created,
    stages,
  };
}

export const store = {
  listProjects(): ProjectSummary[] {
    return load()
      .projects.slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summary);
  },

  getProject(id: string): Project {
    return structuredClone(findProject(load(), id));
  },

  createProject(body: { name?: string; templateId?: string }): Project {
    const db = load();
    let project: Project;
    if (body.templateId) {
      const tpl = db.templates.find((t) => t.id === body.templateId);
      if (!tpl) throw new Error('Шаблон не найден');
      project = cloneFromTemplate(tpl, body.name);
    } else {
      const id = uid();
      const created = now();
      const stageId = uid();
      project = {
        id,
        name: body.name?.trim() || 'Новый проект',
        createdAt: created,
        updatedAt: created,
        stages: [
          {
            id: stageId,
            projectId: id,
            name: 'Общие работы',
            sortOrder: 0,
            items: [],
            extraMaterials: 0,
            extraLabor: 0,
            extraNote: '',
          },
        ],
      };
    }
    db.projects.unshift(project);
    save(db);
    return structuredClone(project);
  },

  renameProject(id: string, name: string): Project {
    const db = load();
    const p = findProject(db, id);
    p.name = name;
    touch(p);
    save(db);
    return structuredClone(p);
  },

  deleteProject(id: string): void {
    const db = load();
    db.projects = db.projects.filter((p) => p.id !== id);
    save(db);
  },

  addStage(id: string, name: string): Project {
    const db = load();
    const p = findProject(db, id);
    const stageId = uid();
    p.stages.push({
      id: stageId,
      projectId: id,
      name: name.trim() || 'Новый этап',
      sortOrder: p.stages.length,
      items: [],
      extraMaterials: 0,
      extraLabor: 0,
      extraNote: '',
    });
    touch(p);
    save(db);
    return structuredClone(p);
  },

  updateStage(
    id: string,
    stageId: string,
    body: { name?: string; extraMaterials?: number; extraLabor?: number; extraNote?: string },
  ): Project {
    const db = load();
    const p = findProject(db, id);
    const stage = p.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error('Этап не найден');
    if (body.name !== undefined) stage.name = body.name;
    if (body.extraMaterials !== undefined) stage.extraMaterials = body.extraMaterials;
    if (body.extraLabor !== undefined) stage.extraLabor = body.extraLabor;
    if (body.extraNote !== undefined) stage.extraNote = body.extraNote;
    touch(p);
    save(db);
    return structuredClone(p);
  },

  deleteStage(id: string, stageId: string): Project {
    const db = load();
    const p = findProject(db, id);
    p.stages = p.stages.filter((s) => s.id !== stageId);
    touch(p);
    save(db);
    return structuredClone(p);
  },

  addItem(id: string, stageId: string, body: Record<string, unknown>): Project {
    const db = load();
    const p = findProject(db, id);
    const stage = p.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error('Этап не найден');

    let name = String(body.name ?? 'Позиция');
    let unit = String(body.unit ?? 'шт');
    let materialPrice = Number(body.materialPrice ?? 0);
    let laborPrice = Number(body.laborPrice ?? 0);
    const catalogItemId = body.catalogItemId ? String(body.catalogItemId) : null;

    if (catalogItemId) {
      const cat = db.catalog.find((c) => c.id === catalogItemId);
      if (cat) {
        name = body.name ? String(body.name) : cat.name;
        unit = body.unit ? String(body.unit) : cat.unit;
        materialPrice = body.materialPrice !== undefined ? Number(body.materialPrice) : cat.materialPrice;
        laborPrice = body.laborPrice !== undefined ? Number(body.laborPrice) : cat.laborPrice;
      }
    }

    stage.items.push({
      id: uid(),
      stageId,
      name,
      unit,
      qty: Number(body.qty ?? 0),
      materialPrice,
      laborPrice,
      note: String(body.note ?? ''),
      catalogItemId,
      sortOrder: stage.items.length,
    });
    touch(p);
    save(db);
    return structuredClone(p);
  },

  updateItem(id: string, itemId: string, body: Record<string, unknown>): Project {
    const db = load();
    const p = findProject(db, id);
    for (const stage of p.stages) {
      const item = stage.items.find((i) => i.id === itemId);
      if (!item) continue;
      if (body.name !== undefined) item.name = String(body.name);
      if (body.unit !== undefined) item.unit = String(body.unit);
      if (body.qty !== undefined) item.qty = Number(body.qty);
      if (body.materialPrice !== undefined) item.materialPrice = Number(body.materialPrice);
      if (body.laborPrice !== undefined) item.laborPrice = Number(body.laborPrice);
      if (body.note !== undefined) item.note = String(body.note);
      touch(p);
      save(db);
      return structuredClone(p);
    }
    throw new Error('Позиция не найдена');
  },

  deleteItem(id: string, itemId: string): Project {
    const db = load();
    const p = findProject(db, id);
    for (const stage of p.stages) {
      const before = stage.items.length;
      stage.items = stage.items.filter((i) => i.id !== itemId);
      if (stage.items.length !== before) {
        touch(p);
        save(db);
        return structuredClone(p);
      }
    }
    throw new Error('Позиция не найдена');
  },

  catalog(): CatalogItem[] {
    return structuredClone(load().catalog).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },

  createCatalogItem(body: Partial<CatalogItem>): { id: string } {
    const db = load();
    const id = uid();
    db.catalog.push({
      id,
      name: body.name?.trim() || 'Материал',
      unit: body.unit?.trim() || 'шт',
      materialPrice: body.materialPrice ?? 0,
      laborPrice: body.laborPrice ?? 0,
      note: body.note ?? '',
    });
    save(db);
    return { id };
  },

  updateCatalogItem(id: string, body: Partial<CatalogItem>): void {
    const db = load();
    const item = db.catalog.find((c) => c.id === id);
    if (!item) throw new Error('Не найдено');
    Object.assign(item, {
      name: body.name ?? item.name,
      unit: body.unit ?? item.unit,
      materialPrice: body.materialPrice ?? item.materialPrice,
      laborPrice: body.laborPrice ?? item.laborPrice,
      note: body.note ?? item.note,
    });
    save(db);
  },

  deleteCatalogItem(id: string): void {
    const db = load();
    db.catalog = db.catalog.filter((c) => c.id !== id);
    save(db);
  },

  templates(): Array<{ id: string; name: string; description: string }> {
    return load().templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }));
  },

  getTemplate(id: string): TemplateFull {
    const tpl = load().templates.find((t) => t.id === id);
    if (!tpl) throw new Error('Шаблон не найден');
    return structuredClone(tpl);
  },

  updateTemplateItem(templateId: string, itemId: string, body: Record<string, unknown>): void {
    const db = load();
    const tpl = db.templates.find((t) => t.id === templateId);
    if (!tpl) throw new Error('Шаблон не найден');
    for (const stage of tpl.stages) {
      const item = stage.items.find((i) => i.id === itemId);
      if (!item) continue;
      if (body.name !== undefined) item.name = String(body.name);
      if (body.unit !== undefined) item.unit = String(body.unit);
      if (body.qty !== undefined) item.qty = Number(body.qty);
      if (body.materialPrice !== undefined) item.materialPrice = Number(body.materialPrice);
      if (body.laborPrice !== undefined) item.laborPrice = Number(body.laborPrice);
      if (body.note !== undefined) item.note = String(body.note);
      save(db);
      return;
    }
    throw new Error('Позиция не найдена');
  },

  isAdmin(): boolean {
    return sessionStorage.getItem(ADMIN_KEY) === '1';
  },

  adminLogin(password: string): void {
    if (password !== ADMIN_PASSWORD) throw new Error('Неверный пароль');
    sessionStorage.setItem(ADMIN_KEY, '1');
  },

  adminLogout(): void {
    sessionStorage.removeItem(ADMIN_KEY);
  },

  requireAdmin(): void {
    if (!store.isAdmin()) throw new Error('Unauthorized');
  },
};
