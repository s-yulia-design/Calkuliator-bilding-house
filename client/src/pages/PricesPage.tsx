import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogItem, PriceSettings } from '@shared/types';
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

export function PricesPage() {
  const [tab, setTab] = useState<'catalog' | 'template'>('catalog');
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [template, setTemplate] = useState<TemplateFull | null>(null);
  const [settings, setSettings] = useState<PriceSettings>({
    region: '',
    pricesUpdatedAt: '',
  });

  async function loadData() {
    const [cat, tpl, st] = await Promise.all([
      api.catalog(),
      api.getTemplate('001') as Promise<TemplateFull>,
      api.getSettings(),
    ]);
    setCatalog(cat);
    setTemplate(tpl);
    setSettings(st);
  }

  useEffect(() => {
    void loadData().catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Настройка цен
          <span>Материалы, работы и актуальность прайса</span>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/">
          Калькулятор
        </Link>
      </header>

      <section className="card">
        <h2>Актуальность цен</h2>
        <p className="muted">Эти данные отображаются в итоговой смете, при печати и в экспорте.</p>
        <div className="extra-grid">
          <div className="field">
            <label>Регион</label>
            <input
              value={settings.region}
              onChange={(e) => setSettings({ ...settings, region: e.target.value })}
              onBlur={() => {
                void api.updateSettings({ region: settings.region }).catch((err) =>
                  setError(err instanceof Error ? err.message : 'Ошибка'),
                );
              }}
              placeholder="Московская область"
            />
          </div>
          <div className="field">
            <label>Дата обновления цен</label>
            <input
              type="date"
              value={settings.pricesUpdatedAt}
              onChange={(e) => setSettings({ ...settings, pricesUpdatedAt: e.target.value })}
              onBlur={() => {
                void api.updateSettings({ pricesUpdatedAt: settings.pricesUpdatedAt }).catch((err) =>
                  setError(err instanceof Error ? err.message : 'Ошибка'),
                );
              }}
            />
          </div>
        </div>
      </section>

      <nav className="admin-nav" style={{ marginTop: '1rem' }}>
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
          Шаблон 001
        </button>
      </nav>

      {error && <p className="error">{error}</p>}

      {tab === 'catalog' && (
        <CatalogEditor
          items={catalog}
          onChange={async () => setCatalog(await api.catalog())}
          onError={setError}
        />
      )}

      {tab === 'template' && template && (
        <TemplateEditor
          template={template}
          onChange={async () => {
            setTemplate((await api.getTemplate('001')) as TemplateFull);
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function CatalogEditor({
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
        <div
          className="row"
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem' }}
        >
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

function TemplateEditor({
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
                      <div className="muted">
                        {formatMoney(item.qty * (item.materialPrice + item.laborPrice))}
                      </div>
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
