import type { Listing, Order, OrderState } from '../lib/types';

type MarketChartsProps = {
  orders: Order[];
  listings: Listing[];
};

type DailyPoint = {
  key: string;
  label: string;
  count: number;
  amount: number;
};

const STATUS_META: Array<{ status: OrderState; label: string; color: string }> = [
  { status: 'CREATED', label: 'Created', color: '#71717a' },
  { status: 'PAID', label: 'Paid', color: '#3b82f6' },
  { status: 'RUNNING', label: 'Running', color: '#f59e0b' },
  { status: 'COMPLETED', label: 'Completed', color: '#22c55e' },
  { status: 'FAILED', label: 'Failed', color: '#ef4444' }
];

function toUsd(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function lastSevenDays(orders: Order[]): DailyPoint[] {
  const now = new Date();
  const days: DailyPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push({
      key: dayKey(current),
      label: dayLabel(current),
      count: 0,
      amount: 0
    });
  }

  const byKey = new Map(days.map((item) => [item.key, item]));
  for (const order of orders) {
    const parsed = new Date(order.created_at);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const key = dayKey(parsed);
    const bucket = byKey.get(key);
    if (!bucket) {
      continue;
    }
    bucket.count += 1;
    bucket.amount += toUsd(order.amount_usdt);
  }

  return days;
}

function trendPath(points: number[], width: number, height: number): string {
  if (points.length === 0) {
    return '';
  }
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  return points
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function MarketCharts({ orders, listings }: MarketChartsProps) {
  const statusCounts = STATUS_META.map((meta) => ({
    ...meta,
    value: orders.filter((order) => order.status === meta.status).length
  }));
  const statusTotal = statusCounts.reduce((acc, item) => acc + item.value, 0);
  const statusGradient =
    statusTotal > 0
      ? `conic-gradient(${statusCounts
          .map((item, index) => {
            const previous = statusCounts.slice(0, index).reduce((acc, current) => acc + current.value, 0);
            const start = (previous / statusTotal) * 100;
            const end = ((previous + item.value) / statusTotal) * 100;
            return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
          })
          .join(', ')})`
      : 'conic-gradient(#27272a 0% 100%)';

  const sevenDays = lastSevenDays(orders);
  const countPoints = sevenDays.map((item) => item.count);
  const amountPoints = sevenDays.map((item) => item.amount);
  const amountMax = Math.max(...amountPoints, 0);

  const listingTitleMap = new Map(listings.map((listing) => [listing.listing_id, listing.title]));
  const listingStats = new Map<string, { count: number; amount: number }>();
  for (const order of orders) {
    const stat = listingStats.get(order.service_id) ?? { count: 0, amount: 0 };
    stat.count += 1;
    stat.amount += toUsd(order.amount_usdt);
    listingStats.set(order.service_id, stat);
  }
  const topListings = [...listingStats.entries()]
    .map(([id, stat]) => ({
      id,
      title: listingTitleMap.get(id) ?? id,
      count: stat.count,
      amount: stat.amount
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topListingMax = Math.max(...topListings.map((item) => item.count), 1);

  return (
    <section className="analytics-grid">
      <article className="card analytics-card">
        <p className="card-label">Analytics</p>
        <h2 className="card-title">ClawJob Status Mix</h2>
        <div className="donut-layout">
          <div className="donut-ring" style={{ background: statusGradient }} aria-label="status distribution">
            <div className="donut-center">
              <p>{statusTotal}</p>
              <span>Total</span>
            </div>
          </div>
          <div className="donut-legend">
            {statusCounts.map((item) => (
              <p key={item.status}>
                <i style={{ background: item.color }} />
                <span>{item.label}</span>
                <b>{item.value}</b>
              </p>
            ))}
          </div>
        </div>
      </article>

      <article className="card analytics-card">
        <p className="card-label">Analytics</p>
        <h2 className="card-title">7-Day ClawJob Trend</h2>
        <svg className="trend-svg" viewBox="0 0 420 170" role="img" aria-label="7-day order count trend">
          <path d={trendPath(countPoints, 420, 150)} />
        </svg>
        <div className="trend-axis">
          {sevenDays.map((item) => (
            <span key={item.key}>{item.label}</span>
          ))}
        </div>
      </article>

      <article className="card analytics-card">
        <p className="card-label">Analytics</p>
        <h2 className="card-title">7-Day Settled Amount (USDT)</h2>
        <div className="amount-bars">
          {sevenDays.map((item) => (
            <div key={item.key} className="amount-bar-col">
              <div className="amount-bar-track">
                <div className="amount-bar" style={{ height: `${amountMax > 0 ? (item.amount / amountMax) * 100 : 0}%` }} />
              </div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="card analytics-card">
        <p className="card-label">Analytics</p>
        <h2 className="card-title">Top Listings by ClawJobs</h2>
        {topListings.length === 0 ? (
          <p className="empty-hint">No listing stats yet.</p>
        ) : (
          <div className="rank-list">
            {topListings.map((item) => (
              <div key={item.id} className="rank-row">
                <p className="rank-title">{item.title}</p>
                <div className="rank-bar-track">
                  <div className="rank-bar" style={{ width: `${(item.count / topListingMax) * 100}%` }} />
                </div>
                <p className="rank-meta">
                  {item.count} jobs · {item.amount.toFixed(2)} USDT
                </p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
