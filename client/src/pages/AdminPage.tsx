import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogItem } from '@shared/types';
import { formatMoney } from '@shared/types';
import { api } from '../lib/api';

type TemplateFull = {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      unit: string;
      qty: number;
      materialPrice: number;
      laborPrice: number;
      note: string;
    }>;
  }>;
};

export function AdminPage() {
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'catalog' | 'template' | 'projects'>('catalog');
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [template, setTemplate] = useState<TemplateFull | null>(null);
  const [projects, setProjects] = useState<
    Array<{ id: string; name: string; updatedAt: string; totals: { total: number } }>
  >([]);

  async function check() {
    try {
      const me = await api.adminMe();
      setAdmin(me.admin);
      if (me.admin) await loadData();
    } catch {
      setAdmin(false);
    }
  }

  async function loadData() {
    const [cat, tpl, projs] = await Promise.all([
      api.catalog(),
      api.getTemplate('nigmetova') as Promise<TemplateFull>,
      api.adminProjects(),
    ]);
    setCatalog(cat);
    setTemplate(tpl);
    setProjects(projs);
  }

  useEffect(() => {
    void check();
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.adminLogin(password);
      setAdmin(true);
      setPassword('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    }
  }

  async function logout() {
    await api.adminLogout();
    setAdmin(false);
  }

  if (!admin) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            Админка
            <span>Каталог цен и шаблоны</span>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/">
            Калькулятор
          </Link>
        </header>
        <form className="card" onSubmit={(e) => void login(e)} style={{ maxWidth: 400 }}>
          <h1>Вход</h1>
          <div className="field">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit">
            Войти
          </button>
          <p className="muted" style={{ marginTop: '0.8rem' }}>
            По умолчанию: admin123 (см. .env)
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Админка
          <span>Управление данными</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link className="btn btn-secondary btn-sm" to="/">
            Калькулятор
          </Link>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        <button
          type="button"
          className={`btn btn-sm ${tab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('catalog')}
        >
          Каталог цен
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'template' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('template')}
        >
          Шаблон ИЖД
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('projects')}
        >
          Все проекты
        </button>
      </nav>

      {error && <p className="error">{error}</p>}

      {tab === 'catalog' && (
        <CatalogAdmin
          items={catalog}
          onChange={async () => {
            setCatalog(await api.catalog());
          }}
          onError={setError}
        />
      )}

      {tab === 'template' && template && (
        <TemplateAdmin
          template={template}
          onChange={async () => {
            setTemplate((await api.getTemplate('nigmetova')) as TemplateFull);
          }}
          onError={setError}
        />
      )}

      {tab === 'projects' && (
        <div className="card">
          <h2>Проекты на сервере</h2>
          {projects.length === 0 ? (
            <p className="muted">Пока нет</p>
          ) : (
            <div className="project-list">
              {projects.map((p) => (
                <div key={p.id} className="project-row" style={{ cursor: 'default' }}>
                  <div>
                    <h3>{p.name}</h3>
                    <div className="muted">
                      обновлён {new Date(p.updatedAt).toLocaleString('ru-RU')}
                      {'totals' in p && p.totals
                        ? ` · ${formatMoney(p.totals.total)}`
                        : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link className="btn btn-secondary btn-sm" to={`/p/${p.id}`}>
                      Открыть
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={async () => {
                        if (!confirm('Удалить проект?')) return;
                        await api.deleteProject(p.id);
                        setProjects(await api.adminProjects());
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogAdmin({
  items,
  onChange,
  onError,
}: {
  items: CatalogItem[];
  onChange: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    unit: 'м³',
    materialPrice: 0,
    laborPrice: 0,
  });

  return (
    <div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            try {
              await api.createCatalogItem(draft);
              setDraft({ name: '', unit: 'м³', materialPrice: 0, laborPrice: 0 });
              await onChange();
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Ошибка');
            }
          })();
        }}
      >
        <h2>Новая позиция каталога</h2>
        <div className="row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem' }}>
          <div className="field">
            <label>Название</label>
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Ед.</label>
            <input
              required
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Цена мат.</label>
            <input
              type="number"
              value={draft.materialPrice}
              onChange={(e) => setDraft({ ...draft, materialPrice: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Работа</label>
            <input
              type="number"
              value={draft.laborPrice}
              onChange={(e) => setDraft({ ...draft, laborPrice: Number(e.target.value) })}
            />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          Добавить
        </button>
      </form>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table className="data">
          <thead>
            <tr>
              <th>Название</th>
              <th>Ед.</th>
              <th>Мат.</th>
              <th>Работа</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    defaultValue={item.name}
                    onBlur={(e) => {
                      if (e.target.value === item.name) return;
                      void api
                        .updateCatalogItem(item.id, { ...item, name: e.target.value })
                        .then(onChange)
                        .catch((err) => onError(String(err)));
                    }}
                  />
                </td>
                <td>
                  <input
                    defaultValue={item.unit}
                    onBlur={(e) => {
                      if (e.target.value === item.unit) return;
                      void api
                        .updateCatalogItem(item.id, { ...item, unit: e.target.value })
                        .then(onChange);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    defaultValue={item.materialPrice}
                    onBlur={(e) => {
                      const materialPrice = Number(e.target.value);
                      if (materialPrice === item.materialPrice) return;
                      void api.updateCatalogItem(item.id, { ...item, materialPrice }).then(onChange);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    defaultValue={item.laborPrice}
                    onBlur={(e) => {
                      const laborPrice = Number(e.target.value);
                      if (laborPrice === item.laborPrice) return;
                      void api.updateCatalogItem(item.id, { ...item, laborPrice }).then(onChange);
                    }}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() => {
                      if (!confirm('Удалить из каталога?')) return;
                      void api.deleteCatalogItem(item.id).then(onChange);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplateAdmin({
  template,
  onChange,
  onError,
}: {
  template: TemplateFull;
  onChange: () => Promise<void>;
  onError: (s: string) => void;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>{template.name}</h2>
        <p className="muted">{template.description}</p>
      </div>
      {template.stages.map((stage) => (
        <div key={stage.id} style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0.5rem 0' }}>{stage.name}</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Ед.</th>
                  <th>Кол-во</th>
                  <th>Цена мат.</th>
                  <th>Работа</th>
                </tr>
              </thead>
              <tbody>
                {stage.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        defaultValue={item.name}
                        onBlur={(e) => {
                          if (e.target.value === item.name) return;
                          void api
                            .updateTemplateItem(template.id, item.id, { name: e.target.value })
                            .then(onChange)
                            .catch((err) => onError(String(err)));
                        }}
                      />
                      {item.note && <div className="muted">{item.note}</div>}
                    </td>
                    <td>
                      <input
                        defaultValue={item.unit}
                        onBlur={(e) => {
                          if (e.target.value === item.unit) return;
                          void api
                            .updateTemplateItem(template.id, item.id, { unit: e.target.value })
                            .then(onChange);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={item.qty}
                        onBlur={(e) => {
                          const qty = Number(e.target.value);
                          if (qty === item.qty) return;
                          void api.updateTemplateItem(template.id, item.id, { qty }).then(onChange);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={item.materialPrice}
                        onBlur={(e) => {
                          const materialPrice = Number(e.target.value);
                          if (materialPrice === item.materialPrice) return;
                          void api
                            .updateTemplateItem(template.id, item.id, { materialPrice })
                            .then(onChange);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={item.laborPrice}
                        onBlur={(e) => {
                          const laborPrice = Number(e.target.value);
                          if (laborPrice === item.laborPrice) return;
                          void api
                            .updateTemplateItem(template.id, item.id, { laborPrice })
                            .then(onChange);
                        }}
                      />
                      <div className="muted">{formatMoney(item.qty * (item.materialPrice + item.laborPrice))}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
