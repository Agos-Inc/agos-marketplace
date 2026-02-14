import type { OrderState } from '../lib/types';

type StatusBadgeProps = {
  status: OrderState;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}
