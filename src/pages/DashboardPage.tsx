import { apiRequest, useQuery } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import type { Order, PageProps } from '../lib/types'

type Summary = {
  products: number
  activeProducts: number
  orders: number
  pendingOrders: number
  customers: number
  revenue: string
  lowStock: Array<{ id: string; stock: number; product: { id: string; name: string } }>
  recentOrders: Order[]
}

export function DashboardPage({ store, token }: PageProps) {
  const summaryQuery = useQuery<Summary | null>(
    ['dashboard', store.slug],
    () => apiRequest(`/stores/${store.slug}/dashboard`, { token }),
    { initialData: null },
  )
  const data = summaryQuery.data

  if (!data) {
    return (
      <section className="panel">
        <div className={summaryQuery.error ? 'notice' : 'empty'}>
          {summaryQuery.error || 'Loading...'}
        </div>
      </section>
    )
  }

  const stats = [
    { label: 'Revenue collected', value: formatMoney(data.revenue, store.currency) },
    { label: 'Orders', value: data.orders, hint: `${data.pendingOrders} pending` },
    { label: 'Customers', value: data.customers },
    { label: 'Products', value: data.products, hint: `${data.activeProducts} active` },
  ]

  return (
    <section className="dashboard">
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="panel stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.hint ? <small>{stat.hint}</small> : null}
          </div>
        ))}
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest</p>
              <h2>Recent orders</h2>
            </div>
            <a href="#/orders">All orders</a>
          </div>
          <div className="table">
            {data.recentOrders.map((order) => (
              <div className="list-row" key={order.id}>
                <div>
                  <strong>{order.guestName ?? 'Guest'}</strong>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                <span>{formatMoney(order.total, store.currency)}</span>
                <span className="status">{order.status}</span>
              </div>
            ))}
            {data.recentOrders.length === 0 ? <div className="empty">No orders yet.</div> : null}
          </div>
        </section>
        <section className="panel">
          <p className="eyebrow">Inventory</p>
          <h2>Low stock</h2>
          <div className="table">
            {data.lowStock.map((variant) => (
              <div className="list-row" key={variant.id}>
                <strong>{variant.product.name}</strong>
                <span className={variant.stock === 0 ? 'status danger' : 'status'}>
                  {variant.stock} left
                </span>
              </div>
            ))}
            {data.lowStock.length === 0 ? (
              <div className="empty">All active products have more than 5 in stock.</div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}
