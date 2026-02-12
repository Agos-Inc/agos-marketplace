import type { OrderCounts } from '../lib/types';

type KpiStripProps = {
  counts: OrderCounts;
};

export function KpiStrip({ counts }: KpiStripProps) {
  const items = [
    { label: 'All Orders', value: counts.all },
    { label: 'Paid', value: counts.paid },
    { label: 'Running', value: counts.running },
    { label: 'Completed Deals', value: counts.completed },
    { label: 'Failed', value: counts.failed }
  ];

  return (
    <section className="kpi-strip">
      {items.map((item) => (
        <article key={item.label} className="kpi-card">
          <p className="kpi-label">{item.label}</p>
          <p className="kpi-value">{item.value}</p>
        </article>
      ))}
    </section>
  );
}
