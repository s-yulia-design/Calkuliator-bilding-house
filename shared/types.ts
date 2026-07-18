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
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
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

export function stageTotals(items: Array<Pick<LineItem, 'qty' | 'materialPrice' | 'laborPrice'>>): Totals {
  return items.reduce(
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
}

export function projectTotals(stages: Array<{ items: Array<Pick<LineItem, 'qty' | 'materialPrice' | 'laborPrice'>> }>): Totals {
  return stages.reduce(
    (acc, stage) => {
      const t = stageTotals(stage.items);
      return {
        materials: acc.materials + t.materials,
        labor: acc.labor + t.labor,
        total: acc.total + t.total,
      };
    },
    { materials: 0, labor: 0, total: 0 },
  );
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}
