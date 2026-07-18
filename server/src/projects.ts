import { nanoid } from 'nanoid';
import { projectTotals } from '../../shared/types.ts';
import { db } from './db.ts';

type StageRow = { id: string; project_id: string; name: string; sort_order: number };
type ItemRow = {
  id: string;
  stage_id: string;
  name: string;
  unit: string;
  qty: number;
  material_price: number;
  labor_price: number;
  note: string;
  catalog_item_id: string | null;
  sort_order: number;
};

function mapItem(row: ItemRow) {
  return {
    id: row.id,
    stageId: row.stage_id,
    name: row.name,
    unit: row.unit,
    qty: row.qty,
    materialPrice: row.material_price,
    laborPrice: row.labor_price,
    note: row.note || '',
    catalogItemId: row.catalog_item_id,
    sortOrder: row.sort_order,
  };
}

export function getProjectFull(id: string) {
  const project = db
    .prepare('SELECT id, access_key, name, created_at, updated_at FROM projects WHERE id = ?')
    .get(id) as
    | { id: string; access_key: string; name: string; created_at: string; updated_at: string }
    | undefined;
  if (!project) return null;

  const stages = db
    .prepare('SELECT * FROM stages WHERE project_id = ? ORDER BY sort_order')
    .all(id) as StageRow[];

  const itemsStmt = db.prepare('SELECT * FROM line_items WHERE stage_id = ? ORDER BY sort_order');

  const mappedStages = stages.map((s) => {
    const items = (itemsStmt.all(s.id) as ItemRow[]).map(mapItem);
    return {
      id: s.id,
      projectId: s.project_id,
      name: s.name,
      sortOrder: s.sort_order,
      items,
    };
  });

  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    stages: mappedStages,
  };
}

export function touchProject(projectId: string) {
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), projectId);
}

export function listAllProjects() {
  const rows = db
    .prepare('SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC')
    .all() as Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((p) => {
    const full = getProjectFull(p.id)!;
    return {
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      stageCount: full.stages.length,
      totals: projectTotals(full.stages),
    };
  });
}

export function createEmptyProject(name: string) {
  const id = nanoid(10);
  const accessKey = nanoid(16);
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (id, access_key, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, accessKey, name, now, now);

  const stageId = nanoid();
  db.prepare('INSERT INTO stages (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)').run(
    stageId,
    id,
    'Общие работы',
  );

  return getProjectFull(id)!;
}

export function createProjectFromTemplate(templateId: string, name?: string) {
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as
    | { id: string; name: string }
    | undefined;
  if (!tpl) return null;

  const id = nanoid(10);
  const accessKey = nanoid(16);
  const now = new Date().toISOString();
  const projectName = name || tpl.name;

  const stages = db
    .prepare('SELECT * FROM template_stages WHERE template_id = ? ORDER BY sort_order')
    .all(templateId) as Array<{ id: string; name: string; sort_order: number }>;

  const itemsStmt = db.prepare(
    'SELECT * FROM template_items WHERE stage_id = ? ORDER BY sort_order',
  );

  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO projects (id, access_key, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, accessKey, projectName, now, now);

    for (const stage of stages) {
      const stageId = nanoid();
      db.prepare('INSERT INTO stages (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)').run(
        stageId,
        id,
        stage.name,
        stage.sort_order,
      );
      const items = itemsStmt.all(stage.id) as ItemRow[];
      for (const item of items) {
        db.prepare(
          `INSERT INTO line_items (id, stage_id, name, unit, qty, material_price, labor_price, note, catalog_item_id, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          nanoid(),
          stageId,
          item.name,
          item.unit,
          item.qty,
          item.material_price,
          item.labor_price,
          item.note,
          item.catalog_item_id,
          item.sort_order,
        );
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return getProjectFull(id)!;
}

export function getTemplateFull(id: string) {
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as
    | { id: string; name: string; description: string }
    | undefined;
  if (!tpl) return null;

  const stages = db
    .prepare('SELECT * FROM template_stages WHERE template_id = ? ORDER BY sort_order')
    .all(id) as Array<{ id: string; name: string; sort_order: number }>;

  const itemsStmt = db.prepare(
    'SELECT * FROM template_items WHERE stage_id = ? ORDER BY sort_order',
  );

  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sort_order,
      items: (itemsStmt.all(s.id) as ItemRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        qty: row.qty,
        materialPrice: row.material_price,
        laborPrice: row.labor_price,
        note: row.note || '',
        catalogItemId: row.catalog_item_id,
        sortOrder: row.sort_order,
      })),
    })),
  };
}
