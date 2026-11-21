import { useState } from 'react'
import { apiRequest, useQuery } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import type { Customer, Order, PageProps } from '../lib/types'

type CustomerDetail = Omit<Customer, 'orderCount' | 'totalSpent' | 'lastOrderAt'> & {
  orders: Order[]
}

export function CustomersPage({ store, token }: PageProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const base = `/stores/${store.slug}/customers`

  const customersQuery = useQuery<Customer[]>(
    ['customers', store.slug],
    () => apiRequest(base, { token }),
    { initialData: [] },
  )
  const detailQuery = useQuery<CustomerDetail | null>(
    ['customer', selectedId],
    () => apiRequest(`${base}/${selectedId}`, { token }),
    { enabled: Boolean(selectedId), initialData: null },
  )

  const term = search.trim().toLowerCase()
  const customers = customersQuery.data.filter(
    (customer) =>
      customer.email.includes(term) || customer.name.toLowerCase().includes(term),
  )
  const detail = selectedId && detailQuery.data?.id === selectedId ? detailQuery.data : null

  return (
    <section className="content-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Customers</p>
            <h2>{customers.length} customers</h2>
          </div>
          <button type="button" className="secondary" onClick={() => customersQuery.refetch()}>
            {customersQuery.isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {customersQuery.error ? <div className="notice">{customersQuery.error}</div> : null}
        <div className="filterbar">
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </label>
        </div>
        <div className="table">
          {customers.map((customer) => (
            <button
              type="button"
              className={selectedId === customer.id ? 'customer-row selected' : 'customer-row'}
              key={customer.id}
              onClick={() => setSelectedId(customer.id)}
            >
              <span>
                <strong>{customer.name}</strong>
                <small>{customer.email}</small>
              </span>
              <span>{customer.orderCount} orders</span>
              <span>{formatMoney(customer.totalSpent, store.currency)}</span>
            </button>
          ))}
          {customers.length === 0 ? (
            <div className="empty">Customers appear after their first checkout.</div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        {detail ? (
          <>
            <p className="eyebrow">Customer</p>
            <h2>{detail.name}</h2>
            <div className="settings-list">
              <div>
                <span>Email</span>
                <strong>{detail.email}</strong>
              </div>
              <div>
                <span>Customer since</span>
                <strong>{formatDate(detail.createdAt)}</strong>
              </div>
            </div>
            <h3>Orders</h3>
            <div className="table">
              {detail.orders.map((order) => (
                <div className="list-row" key={order.id}>
                  <div>
                    <strong>#{order.id.slice(-6)}</strong>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <span>{formatMoney(order.total, store.currency)}</span>
                  <span className="status">{order.status}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">Select a customer to see their orders.</div>
        )}
      </section>
    </section>
  )
}
