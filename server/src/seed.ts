import { nanoid } from 'nanoid';
import { db } from './db.ts';
import { defaultCatalog, nigmetovaTemplate } from '../../shared/seed-data.ts';

const ENGINEERING = 'Инженерные системы и отделка';

export function seedIfEmpty() {
  const tplCount = db.prepare('SELECT COUNT(*) AS c FROM templates').get() as { c: number };
  if (tplCount.c === 0) {
    seedTemplate();
  } else {
    ensureEngineeringTemplateStage();
  }

  const catCount = db.prepare('SELECT COUNT(*) AS c FROM catalog_items').get() as { c: number };
  if (catCount.c === 0) {
    seedCatalog();
  } else {
    ensureCatalogExtras();
  }

  ensureEngineeringOnAllProjects();
}

function ensureEngineeringOnAllProjects() {
  const stageSeed = nigmetovaTemplate.stages.find((s) => s.name === ENGINEERING);
  if (!stageSeed) return;

  const projects = db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>;
  const hasStage = db.prepare('SELECT id FROM stages WHERE project_id = ? AND name = ?');
  const insertStage = db.prepare(
    'INSERT INTO stages (id, project_id, name, sort_order, extra_materials, extra_labor, extra_note) VALUES (?, ?, ?, ?, 0, 0, ?)',
  );
  const insertItem = db.prepare(
    `INSERT INTO line_items (id, stage_id, name, unit, qty, material_price, labor_price, note, catalog_item_id, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, NULL, ?)`,
  );
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM stages WHERE project_id = ?',
  );

  for (const p of projects) {
    if (hasStage.get(p.id, ENGINEERING)) continue;
    const max = maxOrder.get(p.id) as { m: number };
    const stageId = nanoid();
    insertStage.run(stageId, p.id, ENGINEERING, max.m + 1, '');
    stageSeed.items.forEach((item, ii) => {
      insertItem.run(nanoid(), stageId, item.name, item.unit, item.qty, item.note ?? '', ii);
    });
  }
}

function seedCatalog() {
  const insert = db.prepare(
    `INSERT INTO catalog_items (id, name, unit, material_price, labor_price, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  db.exec('BEGIN');
  try {
    for (const item of defaultCatalog) {
      insert.run(nanoid(), item.name, item.unit, item.materialPrice, item.laborPrice, item.note ?? '');
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function ensureCatalogExtras() {
  const insert = db.prepare(
    `INSERT INTO catalog_items (id, name, unit, material_price, labor_price, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const exists = db.prepare('SELECT id FROM catalog_items WHERE name = ?');
  for (const item of defaultCatalog) {
    if (exists.get(item.name)) continue;
    insert.run(nanoid(), item.name, item.unit, item.materialPrice, item.laborPrice, item.note ?? '');
  }
}

function seedTemplate() {
  const t = nigmetovaTemplate;
  const insertTpl = db.prepare('INSERT INTO templates (id, name, description) VALUES (?, ?, ?)');
  const insertStage = db.prepare(
    'INSERT INTO template_stages (id, template_id, name, sort_order) VALUES (?, ?, ?, ?)',
  );
  const insertItem = db.prepare(
    `INSERT INTO template_items (id, stage_id, name, unit, qty, material_price, labor_price, note, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
  );

  db.exec('BEGIN');
  try {
    insertTpl.run(t.id, t.name, t.description ?? '');
    t.stages.forEach((stage, si) => {
      const stageId = nanoid();
      insertStage.run(stageId, t.id, stage.name, si);
      stage.items.forEach((item, ii) => {
        insertItem.run(nanoid(), stageId, item.name, item.unit, item.qty, item.note ?? '', ii);
      });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function ensureEngineeringTemplateStage() {
  const existing = db
    .prepare('SELECT id FROM template_stages WHERE template_id = ? AND name = ?')
    .get('nigmetova', ENGINEERING) as { id: string } | undefined;
  if (existing) return;

  const stageSeed = nigmetovaTemplate.stages.find((s) => s.name === ENGINEERING);
  if (!stageSeed) return;

  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM template_stages WHERE template_id = ?')
    .get('nigmetova') as { m: number };
  const stageId = nanoid();
  db.prepare(
    'INSERT INTO template_stages (id, template_id, name, sort_order) VALUES (?, ?, ?, ?)',
  ).run(stageId, 'nigmetova', stageSeed.name, max.m + 1);

  const insertItem = db.prepare(
    `INSERT INTO template_items (id, stage_id, name, unit, qty, material_price, labor_price, note, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
  );
  stageSeed.items.forEach((item, ii) => {
    insertItem.run(nanoid(), stageId, item.name, item.unit, item.qty, item.note ?? '', ii);
  });
}
