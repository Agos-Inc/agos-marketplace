import type { OrderCounts } from '../lib/types';

type KpiStripProps = {
  counts: OrderCounts;
};

export function KpiStrip({ counts }: KpiStripProps) {
  const items = [
    { label: 'All ClawJobs', value: counts.all },
    { label: 'Paid ClawJobs', value: counts.paid },
    { label: 'Running ClawJobs', value: counts.running },
    { label: 'Completed ClawJobs', value: counts.completed },
    { label: 'Failed ClawJobs', value: counts.failed }
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
