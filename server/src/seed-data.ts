import type { TemplateSeed } from '../../shared/types.ts';

/** Объёмы из проекта «Нигметова Мадина» (PDF). Цены = 0, заполняются в админке/смете. */
export const nigmetovaTemplate: TemplateSeed = {
  id: 'nigmetova',
  name: 'ИЖД Нигметова (шаблон)',
  description: '1 этаж ~74 м², застройка ~96 м². Объёмы из проектной документации.',
  stages: [
    {
      name: 'Фундамент',
      items: [
        { name: 'Бетон В20 (монолитная плита)', unit: 'м³', qty: 28.86 },
        { name: 'Бетон В7,5 (подбетонка)', unit: 'м³', qty: 10 },
        { name: 'Песок (подготовка)', unit: 'м³', qty: 66.3 },
        { name: 'Арматура ∅12 А500С l=11900', unit: 'шт', qty: 122, note: 'масса ед. ~10,57 кг' },
        { name: 'Арматура ∅12 А500С l=8000', unit: 'шт', qty: 80, note: 'масса ед. ~7,1 кг' },
        { name: 'Арматура ∅8 А500С l=700', unit: 'шт', qty: 96 },
        { name: 'Арматура ∅8 А500С l=1300', unit: 'шт', qty: 202 },
        { name: 'ЭППС 50 мм', unit: 'м²', qty: 12 },
        { name: 'Гидроизоляция мастикой в 2 слоя', unit: 'м²', qty: 12 },
        { name: 'Труба ∅133 (гильза)', unit: 'п.м.', qty: 1 },
      ],
    },
    {
      name: 'Стены и перегородки',
      items: [
        { name: 'Керамзитобетонный блок 200 мм (наружные стены)', unit: 'м³', qty: 17.55, note: 'площадь ~87,75 м²' },
        { name: 'Кирпич облицовочный 1,4НФ солома', unit: 'м³', qty: 10.64, note: 'площадь ~88,67 м²' },
        { name: 'Кирпич облицовочный 1,4НФ шоколад', unit: 'м³', qty: 1.9 },
        { name: 'Кирпич облицовочный 1,4НФ шоколад (цоколь)', unit: 'м³', qty: 0.24 },
        { name: 'Жидкий пеноизол 100 мм', unit: 'м³', qty: 10.16, note: 'площадь ~101,60 м²' },
        { name: 'Керамзитобетонный блок 200 мм (внутренние стены)', unit: 'м³', qty: 5.2, note: 'площадь ~26 м²' },
        { name: 'Кирпич рядовой 1,4НФ (перегородки 120 мм)', unit: 'м³', qty: 7.98, note: 'площадь ~66,25 м²' },
        { name: 'ЭППС 50 мм (цоколь)', unit: 'м³', qty: 0.6, note: 'площадь ~12,06 м²' },
        { name: 'Клинкерная плитка под камень', unit: 'м²', qty: 12.14 },
      ],
    },
    {
      name: 'Армопояс',
      items: [
        { name: 'Бетон В20 (армопояс)', unit: 'м³', qty: 0.617 },
        { name: 'Арматура ∅10 А500С', unit: 'п.м.', qty: 198 },
        { name: 'Арматура ∅8 А500С l=640', unit: 'шт', qty: 180 },
        { name: 'Арматура ∅8 А500С l=800', unit: 'шт', qty: 24 },
      ],
    },
    {
      name: 'Кровля и перекрытие',
      items: [
        { name: 'Мягкая черепица (кровля)', unit: 'м²', qty: 127.07 },
        { name: 'Подкладочный ковёр', unit: 'м²', qty: 127.07 },
        { name: 'OSB-3 12 мм (сплошной настил)', unit: 'м²', qty: 127.07 },
        { name: 'Минераловатный утеплитель 150 мм (перекрытие)', unit: 'м²', qty: 74, note: 'уточнить по факту' },
        { name: 'Брус / стропила 50×150', unit: 'м³', qty: 0, note: 'уточнить по спецификации кровли' },
        { name: 'Обрешётка 25×150', unit: 'м³', qty: 0, note: 'уточнить' },
        { name: 'Софиты металлические', unit: 'м²', qty: 0, note: 'уточнить' },
        { name: 'Пароизоляция', unit: 'м²', qty: 74, note: 'уточнить' },
      ],
    },
    {
      name: 'Окна и двери',
      items: [
        { name: 'Окно ОК-1 (1950×2850)', unit: 'шт', qty: 1 },
        { name: 'Окно ОК-1 (1950×2020)', unit: 'шт', qty: 5 },
        { name: 'Окно ОК-2 (780×2020)', unit: 'шт', qty: 1 },
        { name: 'Дверь внутренняя ДВ-1 (900×2100)', unit: 'шт', qty: 5 },
        { name: 'Дверь внутренняя ДВ-2 (800×2100)', unit: 'шт', qty: 2 },
        { name: 'Дверь входная ДН-1 (1050×2200)', unit: 'шт', qty: 1 },
        { name: 'ЭППС для утепления оконных проёмов (0,6×1,2 м)', unit: 'шт', qty: 13 },
      ],
    },
  ],
};

export const defaultCatalog: Array<{
  name: string;
  unit: string;
  materialPrice: number;
  laborPrice: number;
  note?: string;
}> = [
  { name: 'Бетон В20', unit: 'м³', materialPrice: 6500, laborPrice: 2500 },
  { name: 'Бетон В7,5', unit: 'м³', materialPrice: 5200, laborPrice: 1800 },
  { name: 'Песок', unit: 'м³', materialPrice: 1200, laborPrice: 400 },
  { name: 'Арматура А500С', unit: 'т', materialPrice: 65000, laborPrice: 15000 },
  { name: 'ЭППС 50 мм', unit: 'м²', materialPrice: 350, laborPrice: 150 },
  { name: 'Керамзитобетонный блок 200 мм', unit: 'м³', materialPrice: 5500, laborPrice: 3500 },
  { name: 'Кирпич облицовочный 1,4НФ', unit: 'м³', materialPrice: 18000, laborPrice: 8000 },
  { name: 'Кирпич рядовой 1,4НФ', unit: 'м³', materialPrice: 12000, laborPrice: 6000 },
  { name: 'Жидкий пеноизол', unit: 'м³', materialPrice: 4500, laborPrice: 2000 },
  { name: 'Мягкая черепица', unit: 'м²', materialPrice: 650, laborPrice: 450 },
  { name: 'OSB-3 12 мм', unit: 'м²', materialPrice: 450, laborPrice: 200 },
  { name: 'Минераловатный утеплитель 150 мм', unit: 'м²', materialPrice: 380, laborPrice: 150 },
  { name: 'Окно ПВХ', unit: 'шт', materialPrice: 25000, laborPrice: 5000 },
  { name: 'Дверь входная металлическая', unit: 'шт', materialPrice: 35000, laborPrice: 4000 },
  { name: 'Дверь межкомнатная', unit: 'шт', materialPrice: 12000, laborPrice: 2500 },
];
