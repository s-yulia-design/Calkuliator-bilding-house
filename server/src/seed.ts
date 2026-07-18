import { nanoid } from 'nanoid';
import { db } from './db.ts';
import { defaultCatalog, nigmetovaTemplate } from './seed-data.ts';

export function seedIfEmpty() {
  const tplCount = db.prepare('SELECT COUNT(*) AS c FROM templates').get() as { c: number };
  if (tplCount.c === 0) {
    seedTemplate();
  }

  const catCount = db.prepare('SELECT COUNT(*) AS c FROM catalog_items').get() as { c: number };
  if (catCount.c === 0) {
    seedCatalog();
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
