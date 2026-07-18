import type { CatalogItem, LineItem, PriceSettings, Project, ProjectSummary, Stage } from '@shared/types';
import { normalizeProject, projectTotals } from '@shared/types';
import { defaultCatalog, nigmetovaTemplate } from '@shared/seed-data';

const STORAGE_KEY = 'calc_izh_v3';

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
  settings: PriceSettings;
};

const DEFAULT_SETTINGS: PriceSettings = {
  region: 'Московская область',
  pricesUpdatedAt: '2026-07-01',
};

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function now(): string {
  return new Date().toISOString();
}

function defaultProjectFields(areaM2 = 0): Pick<
  Project,
  'areaM2' | 'deliveryCost' | 'deliveryIncluded' | 'reservePercent'
> {
  return {
    areaM2,
    deliveryCost: 0,
    deliveryIncluded: true,
    reservePercent: 10,
  };
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
      const parsed = JSON.parse(raw) as Partial<Db>;
      if (parsed.projects && parsed.catalog && parsed.templates) {
        const db: Db = {
          projects: parsed.projects.map((p) => normalizeProject(p as Project)),
          catalog: parsed.catalog,
          templates: parsed.templates,
          settings: {
            region: parsed.settings?.region || DEFAULT_SETTINGS.region,
            pricesUpdatedAt: parsed.settings?.pricesUpdatedAt || DEFAULT_SETTINGS.pricesUpdatedAt,
          },
        };
        ensureEngineering(db);
        migrateTemplateIds(db);
        save(db);
        return db;
      }
    }
  } catch {
    // ignore
  }
  const db: Db = {
    projects: [],
    catalog: buildDefaultCatalog(),
    templates: [buildDefaultTemplate()],
    settings: { ...DEFAULT_SETTINGS },
  };
  save(db);
  return db;
}

/** Старый id шаблона nigmetova → 001; убрать «Нигметова» из названий */
function migrateTemplateIds(db: Db) {
  const rename = (s: string) =>
    s
      .replace(/Нигметовой/gi, '001')
      .replace(/Нигметова/gi, '001')
      .replace(/Нигметов/gi, '001')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+—/g, ' —')
      .trim();

  for (const tpl of db.templates) {
    if (tpl.id === 'nigmetova') tpl.id = '001';
    if (/нигметов/i.test(tpl.name)) tpl.name = rename(tpl.name);
    if (tpl.id === '001') tpl.name = 'ИЖД 001 (шаблон)';
    if (/нигметов/i.test(tpl.description || '')) {
      tpl.description = '1 этаж ~74 м², застройка ~96 м². Типовые объёмы для сметы.';
    }
  }
  for (const p of db.projects) {
    if (/нигметов/i.test(p.name)) p.name = rename(p.name);
  }
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
  const n = normalizeProject(p);
  const base = projectTotals(n.stages);
  const delivery = n.deliveryIncluded ? n.deliveryCost : 0;
  return {
    id: n.id,
    name: n.name,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    stageCount: n.stages.length,
    totals: {
      materials: base.materials,
      labor: base.labor,
      total: base.total + delivery,
    },
  };
}

function cloneFromTemplate(
  tpl: TemplateFull,
  name?: string,
  options?: { clearQuantities?: boolean },
): Project {
  const id = uid();
  const created = now();
  const clear = options?.clearQuantities === true;
  const stages: Stage[] = tpl.stages.map((s, si) => {
    const stageId = uid();
    const items: LineItem[] = s.items.map((item, ii) => ({
      id: uid(),
      stageId,
      name: item.name,
      unit: item.unit,
      qty: clear ? 0 : item.qty,
      materialPrice: clear ? 0 : item.materialPrice,
      laborPrice: clear ? 0 : item.laborPrice,
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
    ...defaultProjectFields(tpl.id === '001' || tpl.id === 'nigmetova' ? 73.93 : 0),
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
    return structuredClone(normalizeProject(findProject(load(), id)));
  },

  createProject(body: { name?: string; templateId?: string }): Project {
    const db = load();
    const tpl =
      db.templates.find((t) => t.id === (body.templateId || '001')) ||
      db.templates.find((t) => t.id === 'nigmetova') ||
      db.templates[0];
    if (!tpl) throw new Error('Шаблон не найден');

    // Без templateId — те же этапы/позиции, что у шаблона 001, но объёмы пустые (0)
    const project = body.templateId
      ? cloneFromTemplate(tpl, body.name)
      : cloneFromTemplate(tpl, body.name?.trim() || 'Новый проект', {
          clearQuantities: true,
        });

    db.projects.unshift(project);
    save(db);
    return structuredClone(normalizeProject(project));
  },

  renameProject(id: string, name: string): Project {
    const db = load();
    const p = findProject(db, id);
    p.name = name;
    touch(p);
    save(db);
    return structuredClone(normalizeProject(p));
  },

  updateProject(
    id: string,
    body: Partial<
      Pick<Project, 'name' | 'areaM2' | 'deliveryCost' | 'deliveryIncluded' | 'reservePercent'>
    >,
  ): Project {
    const db = load();
    const p = findProject(db, id);
    if (body.name !== undefined) p.name = body.name;
    if (body.areaM2 !== undefined) p.areaM2 = body.areaM2;
    if (body.deliveryCost !== undefined) p.deliveryCost = body.deliveryCost;
    if (body.deliveryIncluded !== undefined) p.deliveryIncluded = body.deliveryIncluded;
    if (body.reservePercent !== undefined) p.reservePercent = body.reservePercent;
    touch(p);
    save(db);
    return structuredClone(normalizeProject(p));
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
    return structuredClone(normalizeProject(p));
  },

  deleteStage(id: string, stageId: string): Project {
    const db = load();
    const p = findProject(db, id);
    p.stages = p.stages.filter((s) => s.id !== stageId);
    touch(p);
    save(db);
    return structuredClone(normalizeProject(p));
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

  getSettings(): PriceSettings {
    return { ...load().settings };
  },

  updateSettings(body: Partial<PriceSettings>): PriceSettings {
    const db = load();
    if (body.region !== undefined) db.settings.region = body.region;
    if (body.pricesUpdatedAt !== undefined) db.settings.pricesUpdatedAt = body.pricesUpdatedAt;
    save(db);
    return { ...db.settings };
  },
};
