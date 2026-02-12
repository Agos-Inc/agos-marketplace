import { formatTime, shortHex } from '../lib/format';
import type { Order } from '../lib/types';
import { StatusBadge } from './StatusBadge';

type OrderTableProps = {
  orders: Order[];
  activeOrderId?: string | undefined;
  onSelectOrder: (order: Order) => void;
};

export function OrderTable({ orders, activeOrderId, onSelectOrder }: OrderTableProps) {
  if (orders.length === 0) {
    return <p className="empty-hint">No orders yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Listing</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Buyer</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const active = order.order_id === activeOrderId;
            return (
              <tr key={order.order_id} className={active ? 'is-active' : ''} onClick={() => onSelectOrder(order)}>
                <td>
                  <p className="cell-title">{order.order_id}</p>
                  <p className="cell-sub">{shortHex(order.order_id_hex, 10, 8)}</p>
                </td>
                <td>{order.service_id}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>{order.amount_usdt} USDT</td>
                <td title={order.buyer_wallet}>{shortHex(order.buyer_wallet, 8, 6)}</td>
                <td>{formatTime(order.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
