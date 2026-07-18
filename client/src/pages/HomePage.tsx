import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProjectSummary } from '@shared/types';
import { formatMoney } from '@shared/types';
import { Disclaimer } from '../components/Disclaimer';
import { api } from '../lib/api';

export function HomePage() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setProjects(await api.listProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createEmpty() {
    setBusy(true);
    setError('');
    try {
      const p = await api.createProject({ name: 'Новый проект' });
      nav(`/p/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function createFromTemplate() {
    setBusy(true);
    setError('');
    try {
      const p = await api.createProject({
        templateId: '001',
        name: 'ИЖД 001 — смета',
      });
      nav(`/p/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: ProjectSummary) {
    if (!confirm(`Удалить проект «${p.name}»?`)) return;
    try {
      await api.deleteProject(p.id);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Смета ИЖД
          <span>Калькулятор стоимости строительства</span>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/prices">
          Настройка цен
        </Link>
      </header>

      <Disclaimer />

      <section className="card" style={{ marginTop: '1rem' }}>
        <h1>Новый проект</h1>
        <p className="muted">
          Оба варианта создают те же этапы, что в проекте 001. «Новый пустой» — без
          объёмов (количества = 0); «Из шаблона» — с типовыми объёмами. Данные
          сохраняются в этом браузере.
        </p>
        <div className="grid-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => void createEmpty()}>
            Новый пустой
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void createFromTemplate()}
          >
            Из шаблона 001
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section style={{ marginTop: '1.25rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Уже рассчитанные</h2>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : projects.length === 0 ? (
          <div className="empty card">Пока нет смет. Создайте первую выше.</div>
        ) : (
          <div className="project-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className="project-row"
                role="button"
                tabIndex={0}
                onClick={() => nav(`/p/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') nav(`/p/${p.id}`);
                }}
              >
                <div>
                  <h3>{p.name}</h3>
                  <div className="muted">
                    {p.stageCount} этап(ов) · {formatMoney(p.totals.total)}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(p);
                  }}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
