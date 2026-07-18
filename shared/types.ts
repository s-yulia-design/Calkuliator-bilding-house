export type Unit = 'м³' | 'м²' | 'м' | 'шт' | 'п.м.' | 'кг' | 'т' | 'компл.';

export interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  materialPrice: number;
  laborPrice: number;
  note?: string;
}

export interface LineItem {
  id: string;
  stageId: string;
  name: string;
  unit: string;
  qty: number;
  materialPrice: number;
  laborPrice: number;
  catalogItemId?: string | null;
  note?: string;
  sortOrder: number;
}

export interface Stage {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  items: LineItem[];
  /** Доп. материалы (сумма ₽) */
  extraMaterials: number;
  /** Доп. работы (сумма ₽) */
  extraLabor: number;
  /** Заметка: что за доп. материалы и работы */
  extraNote: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
  /** Площадь дома, м² (для стоимости за м²) */
  areaM2: number;
  /** Стоимость доставки материалов, ₽ */
  deliveryCost: number;
  /** Включать доставку в итог сметы */
  deliveryIncluded: boolean;
  /** Рекомендуемый резерв, % (не входит в итог автоматически) */
  reservePercent: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stageCount: number;
  totals: Totals;
}

export interface Totals {
  materials: number;
  labor: number;
  total: number;
}

/** Метаданные прайса (регион и актуальность) */
export interface PriceSettings {
  region: string;
  pricesUpdatedAt: string; // YYYY-MM-DD
}

export interface EstimateBreakdown {
  materials: number;
  labor: number;
  other: number;
  delivery: number;
  deliveryIncluded: boolean;
  projectTotal: number;
  reservePercent: number;
  reserveAmount: number;
  recommendedBudget: number;
  areaM2: number;
  perSqm: number | null;
  byStage: Array<{ name: string; total: number }>;
  topItems: Array<{ name: string; stageName: string; total: number }>;
  structure: Array<{ key: string; label: string; amount: number; percent: number }>;
}

export interface TemplateStageSeed {
  name: string;
  items: Array<{
    name: string;
    unit: string;
    qty: number;
    note?: string;
    catalogName?: string;
  }>;
}

export interface TemplateSeed {
  id: string;
  name: string;
  description?: string;
  stages: TemplateStageSeed[];
}

export function lineItemTotals(item: Pick<LineItem, 'qty' | 'materialPrice' | 'laborPrice'>): Totals {
  const materials = item.qty * item.materialPrice;
  const labor = item.qty * item.laborPrice;
  return { materials, labor, total: materials + labor };
}

type StageForTotals = {
  items: Array<Pick<LineItem, 'qty' | 'materialPrice' | 'laborPrice'>>;
  extraMaterials?: number;
  extraLabor?: number;
};

export function stageTotals(stage: StageForTotals | Array<Pick<LineItem, 'qty' | 'materialPrice' | 'laborPrice'>>): Totals {
  const items = Array.isArray(stage) ? stage : stage.items;
  const extraMaterials = Array.isArray(stage) ? 0 : (stage.extraMaterials ?? 0);
  const extraLabor = Array.isArray(stage) ? 0 : (stage.extraLabor ?? 0);
  const base = items.reduce(
    (acc, item) => {
      const t = lineItemTotals(item);
      return {
        materials: acc.materials + t.materials,
        labor: acc.labor + t.labor,
        total: acc.total + t.total,
      };
    },
    { materials: 0, labor: 0, total: 0 },
  );
  return {
    materials: base.materials + extraMaterials,
    labor: base.labor + extraLabor,
    total: base.total + extraMaterials + extraLabor,
  };
}

export function projectTotals(stages: StageForTotals[]): Totals {
  return stages.reduce(
    (acc, stage) => {
      const t = stageTotals(stage);
      return {
        materials: acc.materials + t.materials,
        labor: acc.labor + t.labor,
        total: acc.total + t.total,
      };
    },
    { materials: 0, labor: 0, total: 0 },
  );
}

/** Нормализация полей проекта (для старых записей в localStorage) */
export function normalizeProject(p: Project): Project {
  return {
    ...p,
    areaM2: p.areaM2 ?? 0,
    deliveryCost: p.deliveryCost ?? 0,
    deliveryIncluded: p.deliveryIncluded ?? true,
    reservePercent: p.reservePercent ?? 10,
    stages: (p.stages || []).map((s) => ({
      ...s,
      extraMaterials: s.extraMaterials ?? 0,
      extraLabor: s.extraLabor ?? 0,
      extraNote: s.extraNote ?? '',
      items: s.items || [],
    })),
  };
}

export function buildEstimateBreakdown(project: Project): EstimateBreakdown {
  const p = normalizeProject(project);
  let materials = 0;
  let labor = 0;
  let other = 0;
  const byStage: Array<{ name: string; total: number }> = [];
  const itemRows: Array<{ name: string; stageName: string; total: number }> = [];

  for (const stage of p.stages) {
    let stageMat = 0;
    let stageLab = 0;
    for (const item of stage.items) {
      const t = lineItemTotals(item);
      stageMat += t.materials;
      stageLab += t.labor;
      itemRows.push({ name: item.name, stageName: stage.name, total: t.total });
    }
    const extras = (stage.extraMaterials ?? 0) + (stage.extraLabor ?? 0);
    other += extras;
    materials += stageMat;
    labor += stageLab;
    byStage.push({
      name: stage.name,
      total: stageMat + stageLab + extras,
    });
  }

  const delivery = p.deliveryCost ?? 0;
  const deliveryIncluded = p.deliveryIncluded !== false;
  const deliveryInTotal = deliveryIncluded ? delivery : 0;
  const projectTotal = materials + labor + other + deliveryInTotal;
  const reservePercent = p.reservePercent ?? 10;
  const reserveAmount = (projectTotal * reservePercent) / 100;
  const areaM2 = p.areaM2 ?? 0;
  const perSqm = areaM2 > 0 ? projectTotal / areaM2 : null;

  const structureBase = [
    { key: 'materials', label: 'Материалы', amount: materials },
    { key: 'labor', label: 'Работы', amount: labor },
    { key: 'delivery', label: 'Доставка', amount: deliveryInTotal },
    { key: 'other', label: 'Прочие расходы', amount: other },
  ];
  const structureSum = structureBase.reduce((s, x) => s + x.amount, 0) || 1;
  const structure = structureBase.map((x) => ({
    ...x,
    percent: Math.round((x.amount / structureSum) * 1000) / 10,
  }));

  const topItems = itemRows
    .slice()
    .sort((a, b) => b.total - a.total)
    .filter((x) => x.total > 0)
    .slice(0, 5);

  return {
    materials,
    labor,
    other,
    delivery,
    deliveryIncluded,
    projectTotal,
    reservePercent,
    reserveAmount,
    recommendedBudget: projectTotal + reserveAmount,
    areaM2,
    perSqm,
    byStage,
    topItems,
    structure,
  };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateRu(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}
