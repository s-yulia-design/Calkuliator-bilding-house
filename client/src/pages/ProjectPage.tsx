import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CatalogItem, LineItem, PriceSettings, Project } from '@shared/types';
import {
  buildEstimateBreakdown,
  formatDateRu,
  formatMoney,
  lineItemTotals,
  stageTotals,
} from '@shared/types';
import { Disclaimer } from '../components/Disclaimer';
import { EstimateSummary } from '../components/EstimateSummary';
import { api } from '../lib/api';

export function ProjectPage() {
  const { id = '' } = useParams();

  const [project, setProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<PriceSettings>({
    region: '',
    pricesUpdatedAt: '',
  });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [stageId, setStageId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalogPick, setCatalogPick] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setError('Проект не найден');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [p, cat, st] = await Promise.all([
        api.getProject(id),
        api.catalog(),
        api.getSettings(),
      ]);
      setProject(p);
      setCatalog(cat);
      setSettings(st);
      setStageId((prev) => prev || p.stages[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stage = project?.stages.find((s) => s.id === stageId) || project?.stages[0];
  const breakdown = useMemo(
    () => (project ? buildEstimateBreakdown(project) : null),
    [project],
  );
  const stageSum = useMemo(() => (stage ? stageTotals(stage) : null), [stage]);

  async function apply(updater: () => Promise<Project>) {
    try {
      setProject(await updater());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  }

  function exportCsv() {
    if (!project || !breakdown) return;
    const rows: string[][] = [
      ['Регион', settings.region],
      ['Дата обновления цен', formatDateRu(settings.pricesUpdatedAt)],
      [],
      ['Этап', 'Позиция', 'Ед.', 'Кол-во', 'Цена мат.', 'Работа', 'Материалы', 'Работы', 'Итого', 'Заметка'],
    ];
    for (const s of project.stages) {
      for (const item of s.items) {
        const t = lineItemTotals(item);
        rows.push([
          s.name,
          item.name,
          item.unit,
          String(item.qty),
          String(item.materialPrice),
          String(item.laborPrice),
          String(t.materials),
          String(t.labor),
          String(t.total),
          item.note || '',
        ]);
      }
      rows.push([
        s.name,
        'Дополнительно',
        'сумма',
        '1',
        String(s.extraMaterials ?? 0),
        String(s.extraLabor ?? 0),
        String(s.extraMaterials ?? 0),
        String(s.extraLabor ?? 0),
        String((s.extraMaterials ?? 0) + (s.extraLabor ?? 0)),
        s.extraNote || '',
      ]);
    }
    rows.push([]);
    rows.push(['Доставка материалов', String(breakdown.delivery)]);
    rows.push([
      'Доставка включена в итог',
      breakdown.deliveryIncluded ? 'да' : 'нет',
    ]);
    rows.push(['Стоимость материалов', String(breakdown.materials)]);
    rows.push(['Стоимость работ', String(breakdown.labor)]);
    rows.push(['Прочие расходы', String(breakdown.other)]);
    rows.push(['Общая стоимость проекта', String(breakdown.projectTotal)]);
    rows.push([`Резерв ${breakdown.reservePercent}%`, String(breakdown.reserveAmount)]);
    rows.push(['Полный рекомендуемый бюджет', String(breakdown.recommendedBudget)]);
    if (breakdown.perSqm != null) {
      rows.push(['Стоимость за 1 м²', String(Math.round(breakdown.perSqm))]);
    }

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name}.csv`;
    a.click();
  }

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted">Загрузка сметы…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app-shell">
        <p className="error">{error || 'Проект не найден'}</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link className="muted" to="/">
            ← Проекты
          </Link>
          <h1 style={{ marginTop: '0.35rem' }}>
            <input
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              onBlur={() => void apply(() => api.renameProject(id, project.name))}
              style={{
                font: 'inherit',
                fontFamily: 'var(--display)',
                fontSize: '1.5rem',
                border: 'none',
                background: 'transparent',
                width: '100%',
                maxWidth: 520,
              }}
            />
          </h1>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="grid-actions no-print">
        <button className="btn btn-secondary btn-sm" type="button" onClick={exportCsv}>
          CSV
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => window.print()}>
          Печать
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            const name = prompt('Название этапа', 'Новый этап');
            if (!name) return;
            void apply(async () => {
              const p = await api.addStage(id, name);
              setStageId(p.stages[p.stages.length - 1]?.id || '');
              return p;
            });
          }}
        >
          + Этап
        </button>
      </div>

      <div className="stage-tabs no-print">
        {project.stages.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`stage-tab ${s.id === stage?.id ? 'active' : ''}`}
            onClick={() => setStageId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {stage && (
        <>
          <div className="grid-actions no-print" style={{ alignItems: 'center' }}>
            <strong>{stage.name}</strong>
            <span className="muted">этап: {formatMoney(stageSum?.total ?? 0)}</span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                const name = prompt('Переименовать этап', stage.name);
                if (!name) return;
                void apply(() => api.renameStage(id, stage.id, { name }));
              }}
            >
              Переименовать
            </button>
            <button
              className="btn btn-danger btn-sm"
              type="button"
              onClick={() => {
                if (!confirm('Удалить этап со всеми позициями?')) return;
                void apply(async () => {
                  const p = await api.deleteStage(id, stage.id);
                  setStageId(p.stages[0]?.id || '');
                  return p;
                });
              }}
            >
              Удалить этап
            </button>
          </div>

          <div className="grid-actions no-print">
            <select
              value={catalogPick}
              onChange={(e) => setCatalogPick(e.target.value)}
              style={{
                minWidth: 180,
                borderRadius: 999,
                padding: '0.5rem 0.8rem',
                border: '1px solid var(--line)',
              }}
            >
              <option value="">Из каталога…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={!catalogPick}
              onClick={() => {
                void apply(() =>
                  api.addItem(id, stage.id, { catalogItemId: catalogPick, qty: 1 }),
                );
                setCatalogPick('');
              }}
            >
              Добавить из каталога
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() =>
                void apply(() =>
                  api.addItem(id, stage.id, {
                    name: 'Новая позиция',
                    unit: 'шт',
                    qty: 1,
                    materialPrice: 0,
                    laborPrice: 0,
                  }),
                )
              }
            >
              + Пустая позиция
            </button>
          </div>

          <ItemsTable
            items={stage.items}
            onChange={(itemId, patch) => void apply(() => api.updateItem(id, itemId, patch))}
            onDelete={(itemId) => {
              if (!confirm('Удалить позицию?')) return;
              void apply(() => api.deleteItem(id, itemId));
            }}
          />

          <div className="card extra-block">
            <h3>Дополнительно</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Доп. материалы и работы по этому этапу (суммы в ₽) и заметка, что именно делали.
            </p>
            <div className="extra-grid">
              <div className="field">
                <label>Доп. материалы, ₽</label>
                <input
                  type="number"
                  key={`em-${stage.id}-${stage.extraMaterials}`}
                  defaultValue={stage.extraMaterials ?? 0}
                  onBlur={(e) => {
                    const extraMaterials = Number(e.target.value) || 0;
                    if (extraMaterials === (stage.extraMaterials ?? 0)) return;
                    void apply(() => api.renameStage(id, stage.id, { extraMaterials }));
                  }}
                />
              </div>
              <div className="field">
                <label>Доп. работы, ₽</label>
                <input
                  type="number"
                  key={`el-${stage.id}-${stage.extraLabor}`}
                  defaultValue={stage.extraLabor ?? 0}
                  onBlur={(e) => {
                    const extraLabor = Number(e.target.value) || 0;
                    if (extraLabor === (stage.extraLabor ?? 0)) return;
                    void apply(() => api.renameStage(id, stage.id, { extraLabor }));
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label>Заметка (что за доп. материалы и работы)</label>
              <textarea
                rows={3}
                key={`en-${stage.id}-${stage.extraNote}`}
                defaultValue={stage.extraNote ?? ''}
                placeholder="Например: доставка песка, аренда бетононасоса, доп. армирование…"
                onBlur={(e) => {
                  const extraNote = e.target.value;
                  if (extraNote === (stage.extraNote ?? '')) return;
                  void apply(() => api.renameStage(id, stage.id, { extraNote }));
                }}
              />
            </div>
            <div className="muted">
              Доп. к этапу:{' '}
              <b>
                {formatMoney((stage.extraMaterials ?? 0) + (stage.extraLabor ?? 0))}
              </b>
            </div>
          </div>
        </>
      )}

      <section className="card extra-block no-print" style={{ marginTop: '1.25rem' }}>
        <h3>Параметры сметы</h3>
        <div className="extra-grid">
          <div className="field">
            <label>Площадь дома, м²</label>
            <input
              type="number"
              key={`area-${project.id}-${project.areaM2}`}
              defaultValue={project.areaM2 ?? 0}
              onBlur={(e) => {
                const areaM2 = Number(e.target.value) || 0;
                if (areaM2 === (project.areaM2 ?? 0)) return;
                void apply(() => api.updateProject(id, { areaM2 }));
              }}
            />
          </div>
          <div className="field">
            <label>Резерв на непредвиденные, %</label>
            <input
              type="number"
              key={`res-${project.id}-${project.reservePercent}`}
              defaultValue={project.reservePercent ?? 10}
              onBlur={(e) => {
                const reservePercent = Number(e.target.value);
                if (reservePercent === (project.reservePercent ?? 10)) return;
                void apply(() =>
                  api.updateProject(id, {
                    reservePercent: Number.isFinite(reservePercent) ? reservePercent : 10,
                  }),
                );
              }}
            />
          </div>
        </div>
      </section>

      <section className="card extra-block no-print">
        <h3>Доставка материалов</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Отдельная строка сметы — не смешивается со стоимостью материалов.
        </p>
        <div className="extra-grid">
          <div className="field">
            <label>Стоимость доставки, ₽</label>
            <input
              type="number"
              key={`del-${project.id}-${project.deliveryCost}`}
              defaultValue={project.deliveryCost ?? 0}
              onBlur={(e) => {
                const deliveryCost = Number(e.target.value) || 0;
                if (deliveryCost === (project.deliveryCost ?? 0)) return;
                void apply(() => api.updateProject(id, { deliveryCost }));
              }}
            />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <input
                type="checkbox"
                checked={project.deliveryIncluded !== false}
                onChange={(e) =>
                  void apply(() =>
                    api.updateProject(id, { deliveryIncluded: e.target.checked }),
                  )
                }
              />
              Включить доставку в общую стоимость
            </label>
          </div>
        </div>
      </section>

      <div style={{ marginTop: '1.25rem' }}>
        <Disclaimer />
      </div>

      {breakdown && (
        <div style={{ marginTop: '1rem' }}>
          <EstimateSummary breakdown={breakdown} settings={settings} />
        </div>
      )}

      {breakdown && (
        <div className="totals-bar">
          <div>
            <span>Материалы</span>
            <strong>{formatMoney(breakdown.materials)}</strong>
          </div>
          <div>
            <span>Работы</span>
            <strong>{formatMoney(breakdown.labor)}</strong>
          </div>
          <div>
            <span>Доставка</span>
            <strong>
              {formatMoney(breakdown.delivery)}
              {!breakdown.deliveryIncluded ? '*' : ''}
            </strong>
          </div>
          <div>
            <span>Всего</span>
            <strong>{formatMoney(breakdown.projectTotal)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsTable({
  items,
  onChange,
  onDelete,
}: {
  items: LineItem[];
  onChange: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="table-wrap table-desktop">
        <table className="data">
          <thead>
            <tr>
              <th>Наименование</th>
              <th>Ед.</th>
              <th>Кол-во</th>
              <th>Цена мат.</th>
              <th>Работа</th>
              <th>Итого</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const t = lineItemTotals(item);
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      defaultValue={item.name}
                      onBlur={(e) => {
                        if (e.target.value !== item.name) onChange(item.id, { name: e.target.value });
                      }}
                    />
                  </td>
                  <td style={{ width: 70 }}>
                    <input
                      defaultValue={item.unit}
                      onBlur={(e) => {
                        if (e.target.value !== item.unit) onChange(item.id, { unit: e.target.value });
                      }}
                    />
                  </td>
                  <td style={{ width: 90 }}>
                    <input
                      type="number"
                      defaultValue={item.qty}
                      onBlur={(e) => {
                        const qty = Number(e.target.value);
                        if (qty !== item.qty) onChange(item.id, { qty });
                      }}
                    />
                  </td>
                  <td style={{ width: 110 }}>
                    <input
                      type="number"
                      defaultValue={item.materialPrice}
                      onBlur={(e) => {
                        const materialPrice = Number(e.target.value);
                        if (materialPrice !== item.materialPrice) onChange(item.id, { materialPrice });
                      }}
                    />
                  </td>
                  <td style={{ width: 110 }}>
                    <input
                      type="number"
                      defaultValue={item.laborPrice}
                      onBlur={(e) => {
                        const laborPrice = Number(e.target.value);
                        if (laborPrice !== item.laborPrice) onChange(item.id, { laborPrice });
                      }}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatMoney(t.total)}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(item.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="items item-cards-mobile">
        {items.map((item) => {
          const t = lineItemTotals(item);
          return (
            <div className="item-card" key={item.id}>
              <div className="field" style={{ marginBottom: 0.5 }}>
                <label>Наименование</label>
                <input
                  defaultValue={item.name}
                  onBlur={(e) => {
                    if (e.target.value !== item.name) onChange(item.id, { name: e.target.value });
                  }}
                />
              </div>
              <div className="row">
                <div className="field">
                  <label>Ед.</label>
                  <input
                    defaultValue={item.unit}
                    onBlur={(e) => {
                      if (e.target.value !== item.unit) onChange(item.id, { unit: e.target.value });
                    }}
                  />
                </div>
                <div className="field">
                  <label>Кол-во</label>
                  <input
                    type="number"
                    defaultValue={item.qty}
                    onBlur={(e) => {
                      const qty = Number(e.target.value);
                      if (qty !== item.qty) onChange(item.id, { qty });
                    }}
                  />
                </div>
                <div className="field">
                  <label>Цена мат.</label>
                  <input
                    type="number"
                    defaultValue={item.materialPrice}
                    onBlur={(e) => {
                      const materialPrice = Number(e.target.value);
                      if (materialPrice !== item.materialPrice) onChange(item.id, { materialPrice });
                    }}
                  />
                </div>
                <div className="field">
                  <label>Работа</label>
                  <input
                    type="number"
                    defaultValue={item.laborPrice}
                    onBlur={(e) => {
                      const laborPrice = Number(e.target.value);
                      if (laborPrice !== item.laborPrice) onChange(item.id, { laborPrice });
                    }}
                  />
                </div>
              </div>
              <div className="money">
                <span>
                  Мат. <b>{formatMoney(t.materials)}</b>
                </span>
                <span>
                  Раб. <b>{formatMoney(t.labor)}</b>
                </span>
                <span>
                  Итого <b>{formatMoney(t.total)}</b>
                </span>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(item.id)}>
                  Удалить
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && <div className="empty card">Нет позиций в этапе</div>}
    </>
  );
}
