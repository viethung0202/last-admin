import { useState } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { ORDER_STATUSES, formatDate, formatMoney } from '../lib/format'
import type { Order, OrderStatus, PageProps } from '../lib/types'

export function OrdersPage({ store, token, notify }: PageProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [openId, setOpenId] = useState<string | null>(null)
  const base = `/stores/${store.slug}/orders`

  const ordersQuery = useQuery<Order[]>(
    ['orders', store.slug],
    () => apiRequest(base, { token }),
    { initialData: [] },
  )

  const statusMutation = useMutation<{ orderId: string; status: OrderStatus }, Order>(
    (input) =>
      apiRequest(`${base}/${input.orderId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: input.status }),
      }),
    {
      onSuccess: async () => {
        notify('Order status updated')
        await ordersQuery.refetch()
      },
      onError: notify,
    },
  )

  const orders = ordersQuery.data.filter(
    (order) => statusFilter === 'ALL' || order.status === statusFilter,
  )

  return (
    <section className="panel order-list">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Orders</p>
          <h2>{orders.length} orders</h2>
        </div>
        <button type="button" className="secondary" onClick={() => ordersQuery.refetch()}>
          {ordersQuery.isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {ordersQuery.error ? <div className="notice">{ordersQuery.error}</div> : null}
      <div className="filterbar">
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OrderStatus)}
          >
            <option value="ALL">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-row">
              <div>
                <strong>
                  #{order.id.slice(-6)} · {order.guestName ?? 'Guest customer'}
                </strong>
                <span>{order.guestEmail ?? 'No email'}</span>
                <span>
                  {order.payments[0]
                    ? `${order.payments[0].method} · ${order.payments[0].status}`
                    : 'No payment'}
                </span>
              </div>
              <span>{formatMoney(order.total, store.currency)}</span>
              <span>{formatDate(order.createdAt)}</span>
              <select
                value={order.status}
                disabled={statusMutation.isPending}
                onChange={(e) =>
                  statusMutation
                    .mutate({ orderId: order.id, status: e.target.value as OrderStatus })
                    .catch(() => undefined)
                }
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                onClick={() => setOpenId(openId === order.id ? null : order.id)}
              >
                {openId === order.id ? 'Hide' : 'Items'}
              </button>
            </div>
            {openId === order.id ? (
              <ul className="order-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.productNameSnapshot}
                      {item.variantLabelSnapshot !== 'Default' ? ` (${item.variantLabelSnapshot})` : ''}
                    </span>
                    <span>
                      {item.quantity} × {formatMoney(item.unitPrice, store.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
        {orders.length === 0 ? (
          <div className="empty">No orders yet. Storefront checkout will create them here.</div>
        ) : null}
      </div>
    </section>
  )
}
