import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkAdminPassword,
  clearAdminSession,
  isAdmin,
  requireAdmin,
  setAdminSession,
} from './auth.ts';
import { db, initDb } from './db.ts';
import {
  createEmptyProject,
  createProjectFromTemplate,
  getProjectFull,
  getTemplateFull,
  listAllProjects,
  touchProject,
} from './projects.ts';
import { seedIfEmpty } from './seed.ts';

loadEnv();
initDb();
seedIfEmpty();

const app = new Hono();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  '/api/*',
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);

app.get('/api/health', (c) => c.json({ ok: true }));

// —— Auth ——
app.get('/api/admin/me', (c) => c.json({ admin: isAdmin(c) }));

app.post('/api/admin/login', async (c) => {
  let body: { password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Некорректный JSON' }, 400);
  }
  if (!body.password || !checkAdminPassword(body.password)) {
    return c.json({ error: 'Неверный пароль' }, 401);
  }
  setAdminSession(c);
  return c.json({ ok: true });
});

app.post('/api/admin/logout', (c) => {
  clearAdminSession(c);
  return c.json({ ok: true });
});

// —— Catalog (public read, admin write) ——
app.get('/api/catalog', (c) => {
  const rows = db
    .prepare('SELECT * FROM catalog_items ORDER BY name')
    .all() as Array<{
    id: string;
    name: string;
    unit: string;
    material_price: number;
    labor_price: number;
    note: string;
  }>;
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      materialPrice: r.material_price,
      laborPrice: r.labor_price,
      note: r.note || '',
    })),
  );
});

app.post('/api/catalog', requireAdmin, async (c) => {
  const body = await c.req.json<{
    name: string;
    unit: string;
    materialPrice?: number;
    laborPrice?: number;
    note?: string;
  }>();
  if (!body.name?.trim() || !body.unit?.trim()) {
    return c.json({ error: 'name и unit обязательны' }, 400);
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO catalog_items (id, name, unit, material_price, labor_price, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    body.name.trim(),
    body.unit.trim(),
    body.materialPrice ?? 0,
    body.laborPrice ?? 0,
    body.note ?? '',
  );
  return c.json({ id }, 201);
});

app.put('/api/catalog/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name: string;
    unit: string;
    materialPrice: number;
    laborPrice: number;
    note?: string;
  }>();
  const result = db
    .prepare(
      `UPDATE catalog_items SET name=?, unit=?, material_price=?, labor_price=?, note=? WHERE id=?`,
    )
    .run(body.name, body.unit, body.materialPrice, body.laborPrice, body.note ?? '', id);
  if (result.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

app.delete('/api/catalog/:id', requireAdmin, (c) => {
  const result = db.prepare('DELETE FROM catalog_items WHERE id = ?').run(c.req.param('id'));
  if (result.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// —— Templates ——
app.get('/api/templates', (c) => {
  const rows = db.prepare('SELECT id, name, description FROM templates').all();
  return c.json(rows);
});

app.get('/api/templates/:id', (c) => {
  const tpl = getTemplateFull(c.req.param('id'));
  if (!tpl) return c.json({ error: 'Not found' }, 404);
  return c.json(tpl);
});

app.put('/api/templates/:id/items/:itemId', requireAdmin, async (c) => {
  const body = await c.req.json<{
    name?: string;
    unit?: string;
    qty?: number;
    materialPrice?: number;
    laborPrice?: number;
    note?: string;
  }>();
  const itemId = c.req.param('itemId');
  const existing = db.prepare('SELECT * FROM template_items WHERE id = ?').get(itemId) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return c.json({ error: 'Not found' }, 404);
  db.prepare(
    `UPDATE template_items SET name=?, unit=?, qty=?, material_price=?, labor_price=?, note=? WHERE id=?`,
  ).run(
    body.name ?? existing.name,
    body.unit ?? existing.unit,
    body.qty ?? existing.qty,
    body.materialPrice ?? existing.material_price,
    body.laborPrice ?? existing.labor_price,
    body.note ?? existing.note,
    itemId,
  );
  return c.json({ ok: true });
});

// —— Projects ——
app.get('/api/projects', (c) => c.json(listAllProjects()));

app.post('/api/projects', async (c) => {
  const body = await c.req.json<{ name?: string; templateId?: string }>().catch(() => ({}));
  if (body.templateId) {
    const project = createProjectFromTemplate(body.templateId, body.name);
    if (!project) return c.json({ error: 'Шаблон не найден' }, 404);
    return c.json(project, 201);
  }
  const project = createEmptyProject(body.name?.trim() || 'Новый проект');
  return c.json(project, 201);
});

app.get('/api/projects/:id', (c) => {
  const project = getProjectFull(c.req.param('id'));
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json(project);
});

app.patch('/api/projects/:id', async (c) => {
  const id = c.req.param('id');
  if (!getProjectFull(id)) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ name: string }>();
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(
    body.name,
    new Date().toISOString(),
    id,
  );
  return c.json(getProjectFull(id));
});

app.delete('/api/projects/:id', (c) => {
  const id = c.req.param('id');
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (result.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

app.post('/api/projects/:id/stages', async (c) => {
  const projectId = c.req.param('id');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ name: string }>();
  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM stages WHERE project_id = ?')
    .get(projectId) as { m: number };
  const stageId = nanoid();
  db.prepare('INSERT INTO stages (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)').run(
    stageId,
    projectId,
    body.name?.trim() || 'Новый этап',
    max.m + 1,
  );
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

app.patch('/api/projects/:id/stages/:stageId', async (c) => {
  const projectId = c.req.param('id');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ name: string }>();
  db.prepare('UPDATE stages SET name = ? WHERE id = ? AND project_id = ?').run(
    body.name,
    c.req.param('stageId'),
    projectId,
  );
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

app.delete('/api/projects/:id/stages/:stageId', (c) => {
  const projectId = c.req.param('id');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM stages WHERE id = ? AND project_id = ?').run(
    c.req.param('stageId'),
    projectId,
  );
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

app.post('/api/projects/:id/stages/:stageId/items', async (c) => {
  const projectId = c.req.param('id');
  const stageId = c.req.param('stageId');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{
    name?: string;
    unit?: string;
    qty?: number;
    materialPrice?: number;
    laborPrice?: number;
    note?: string;
    catalogItemId?: string;
  }>();

  let name = body.name?.trim() || 'Позиция';
  let unit = body.unit?.trim() || 'шт';
  let materialPrice = body.materialPrice ?? 0;
  let laborPrice = body.laborPrice ?? 0;
  let catalogItemId = body.catalogItemId ?? null;

  if (catalogItemId) {
    const cat = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(catalogItemId) as
      | {
          name: string;
          unit: string;
          material_price: number;
          labor_price: number;
        }
      | undefined;
    if (cat) {
      name = body.name?.trim() || cat.name;
      unit = body.unit?.trim() || cat.unit;
      materialPrice = body.materialPrice ?? cat.material_price;
      laborPrice = body.laborPrice ?? cat.labor_price;
    }
  }

  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM line_items WHERE stage_id = ?')
    .get(stageId) as { m: number };

  db.prepare(
    `INSERT INTO line_items (id, stage_id, name, unit, qty, material_price, labor_price, note, catalog_item_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    stageId,
    name,
    unit,
    body.qty ?? 0,
    materialPrice,
    laborPrice,
    body.note ?? '',
    catalogItemId,
    max.m + 1,
  );
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

app.patch('/api/projects/:id/items/:itemId', async (c) => {
  const projectId = c.req.param('id');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{
    name?: string;
    unit?: string;
    qty?: number;
    materialPrice?: number;
    laborPrice?: number;
    note?: string;
  }>();
  const itemId = c.req.param('itemId');
  const existing = db.prepare('SELECT * FROM line_items WHERE id = ?').get(itemId) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return c.json({ error: 'Not found' }, 404);
  db.prepare(
    `UPDATE line_items SET name=?, unit=?, qty=?, material_price=?, labor_price=?, note=? WHERE id=?`,
  ).run(
    body.name ?? existing.name,
    body.unit ?? existing.unit,
    body.qty ?? existing.qty,
    body.materialPrice ?? existing.material_price,
    body.laborPrice ?? existing.labor_price,
    body.note ?? existing.note,
    itemId,
  );
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

app.delete('/api/projects/:id/items/:itemId', (c) => {
  const projectId = c.req.param('id');
  if (!getProjectFull(projectId)) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM line_items WHERE id = ?').run(c.req.param('itemId'));
  touchProject(projectId);
  return c.json(getProjectFull(projectId));
});

// Admin: list all projects (same data, requires login)
app.get('/api/admin/projects', requireAdmin, (c) => c.json(listAllProjects()));

// Static client in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use('/*', serveStatic({ root: clientDist }));
  app.get('*', (c) => {
    const index = path.join(clientDist, 'index.html');
    return c.html(fs.readFileSync(index, 'utf8'));
  });
}

const port = Number(process.env.PORT || 3001);
console.log(`API http://localhost:${port}`);
serve({ fetch: app.fetch, port });

function loadEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  for (const file of ['.env', path.join('server', '.env')]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
