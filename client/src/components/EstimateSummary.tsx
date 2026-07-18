import type { EstimateBreakdown, PriceSettings } from '@shared/types';
import { formatDateRu, formatMoney } from '@shared/types';

export function EstimateSummary({
  breakdown,
  settings,
}: {
  breakdown: EstimateBreakdown;
  settings: PriceSettings;
}) {
  return (
    <section className="card estimate-summary">
      <h2>Итоговая смета</h2>
      <p className="muted price-meta">
        Регион: {settings.region || '—'} · Цены актуальны на{' '}
        {formatDateRu(settings.pricesUpdatedAt)}
      </p>

      <div className="summary-grid">
        <div className="summary-row summary-row-main">
          <span>Общая стоимость проекта</span>
          <strong>{formatMoney(breakdown.projectTotal)}</strong>
        </div>
        <div className="summary-row">
          <span>Стоимость материалов</span>
          <strong>{formatMoney(breakdown.materials)}</strong>
        </div>
        <div className="summary-row">
          <span>Стоимость работ</span>
          <strong>{formatMoney(breakdown.labor)}</strong>
        </div>
        <div className="summary-row">
          <span>
            Стоимость доставки
            {!breakdown.deliveryIncluded ? ' (не включена в итог)' : ''}
          </span>
          <strong>{formatMoney(breakdown.delivery)}</strong>
        </div>
        {breakdown.other > 0 && (
          <div className="summary-row">
            <span>Прочие расходы (дополнительно по этапам)</span>
            <strong>{formatMoney(breakdown.other)}</strong>
          </div>
        )}
        {breakdown.perSqm != null && (
          <div className="summary-row">
            <span>Стоимость за 1 м² ({breakdown.areaM2} м²)</span>
            <strong>{formatMoney(breakdown.perSqm)}</strong>
          </div>
        )}
      </div>

      <h3>Общая стоимость по этапам</h3>
      <ul className="stage-cost-list">
        {breakdown.byStage.map((s) => (
          <li key={s.name}>
            <span>{s.name}</span>
            <strong>{formatMoney(s.total)}</strong>
          </li>
        ))}
      </ul>

      {breakdown.topItems.length > 0 && (
        <>
          <h3>Самые дорогие позиции</h3>
          <ol className="top-items-list">
            {breakdown.topItems.map((item, i) => (
              <li key={`${item.name}-${i}`}>
                <span>
                  {item.name}
                  <span className="muted"> · {item.stageName}</span>
                </span>
                <strong>{formatMoney(item.total)}</strong>
              </li>
            ))}
          </ol>
        </>
      )}

      <h3>Структура расходов</h3>
      <div className="structure-bars">
        {breakdown.structure.map((s) => (
          <div key={s.key} className="structure-bar-row">
            <div className="structure-bar-label">
              <span>
                {s.label} — {s.percent}%
              </span>
              <span>{formatMoney(s.amount)}</span>
            </div>
            <div className="structure-bar-track">
              <div
                className={`structure-bar-fill structure-bar-${s.key}`}
                style={{ width: `${Math.min(100, s.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="reserve-block">
        <div className="summary-row">
          <span>Рекомендуемый резерв ({breakdown.reservePercent}%)</span>
          <strong>{formatMoney(breakdown.reserveAmount)}</strong>
        </div>
        <div className="summary-row summary-row-main">
          <span>Полный рекомендуемый бюджет</span>
          <strong>{formatMoney(breakdown.recommendedBudget)}</strong>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Резерв не включён в общую стоимость проекта — это рекомендация на непредвиденные расходы.
        </p>
      </div>
    </section>
  );
}
