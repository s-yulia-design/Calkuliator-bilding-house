export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <aside className={`card disclaimer ${className}`.trim()} role="note">
      <p>
        <strong>Расчёт является предварительным</strong> и предназначен для внутреннего использования
        строительной организацией. Перед заключением договора рекомендуется проверить объёмы работ,
        актуальность цен и итоговую стоимость.
      </p>
    </aside>
  );
}
