import { useState } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import type { Order, PageProps, Product } from '../lib/types'

type Line = { variantId: string; quantity: number }
type Form = { guestEmail: string; guestName: string; note: string; discountCode: string; lines: Line[] }

const emptyForm: Form = { guestEmail: '', guestName: '', note: '', discountCode: '', lines: [] }

export function DraftOrdersPage({ store, token, notify }: PageProps) {
  const base = `/stores/${store.slug}/draft-orders`
  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pick, setPick] = useState('')

  const draftsQuery = useQuery<Order[]>(['drafts', store.slug], () => apiRequest(base, { token }), {
    initialData: [],
  })
  const productsQuery = useQuery<Product[]>(
    ['products', store.slug],
    () => apiRequest(`/stores/${store.slug}/products`, { token }),
    { initialData: [] },
  )

  // every variant of every product, labelled "Product — Size / Color"
  const variants = productsQuery.data.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      price: v.price,
      stock: v.stock,
      label: [p.name, Object.values(v.optionValues).join(' / ')].filter(Boolean).join(' — '),
    })),
  )
  const byId = new Map(variants.map((v) => [v.id, v]))
  const estimate = form
    ? form.lines.reduce((sum, l) => sum + Number(byId.get(l.variantId)?.price ?? 0) * l.quantity, 0)
    : 0

  const body = (f: Form) =>
    JSON.stringify({
      guestEmail: f.guestEmail,
      guestName: f.guestName,
      note: f.note,
      discountCode: f.discountCode.trim() || undefined,
      items: f.lines,
    })

  const saveMutation = useMutation<Form, Order>(
    (f) =>
      apiRequest(editingId ? `${base}/${editingId}` : base, {
        method: editingId ? 'PUT' : 'POST',
        token,
        body: body(f),
      }),
    {
      onSuccess: async (draft) => {
        notify(`Draft saved. Total ${formatMoney(draft.total, store.currency)}`)
        setForm(null)
        setEditingId(null)
        await draftsQuery.refetch()
      },
      onError: notify,
    },
  )
  const completeMutation = useMutation<{ id: string; markPaid: boolean }, Order>(
    ({ id, markPaid }) => apiRequest(`${base}/${id}/complete`, { method: 'POST', token, body: JSON.stringify({ markPaid }) }),
    {
      onSuccess: async () => {
        notify('Order created')
        await draftsQuery.refetch()
        await productsQuery.refetch()
      },
      onError: notify,
    },
  )
  const deleteMutation = useMutation<string, unknown>(
    (id) => apiRequest(`${base}/${id}`, { method: 'DELETE', token }),
    {
      onSuccess: async () => {
        notify('Draft deleted')
        await draftsQuery.refetch()
      },
      onError: notify,
    },
  )

  function edit(draft: Order) {
    setEditingId(draft.id)
    setForm({
      guestEmail: draft.guestEmail ?? '',
      guestName: draft.guestName ?? '',
      note: draft.note ?? '',
      discountCode: draft.discountCode ?? '',
      lines: draft.items.flatMap((i) => (i.variantId ? [{ variantId: i.variantId, quantity: i.quantity }] : [])),
    })
  }

  function addLine() {
    if (!form || !pick) return
    const existing = form.lines.find((l) => l.variantId === pick)
    setForm({
      ...form,
      lines: existing
        ? form.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
        : [...form.lines, { variantId: pick, quantity: 1 }],
    })
    setPick('')
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Draft orders</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setForm(emptyForm)
          }}
        >
          Create order
        </button>
      </div>

      {form ? (
        <form
          className="panel form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate(form).catch(() => undefined)
          }}
        >
          <h3 className="card-title">{editingId ? 'Edit draft order' : 'New draft order'}</h3>
          <div className="inline-form">
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a product">
              <option value="">Add a product…</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {formatMoney(v.price, store.currency)} ({v.stock} in stock)
                </option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={!pick} onClick={addLine}>
              Add
            </button>
          </div>
          {form.lines.length > 0 ? (
            <table className="data-table">
              <tbody>
                {form.lines.map((line) => {
                  const v = byId.get(line.variantId)
                  return (
                    <tr key={line.variantId}>
                      <td>{v?.label ?? 'Unknown product'}</td>
                      <td>{v ? formatMoney(v.price, store.currency) : '-'}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          aria-label="Quantity"
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lines: form.lines.map((l) => (l === line ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) } : l)),
                            })
                          }
                        />
                      </td>
                      <td className="row-actions">
                        <button type="button" className="danger" onClick={() => setForm({ ...form, lines: form.lines.filter((l) => l !== line) })}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <span className="muted">No products added yet.</span>
          )}
          <div className="two-col">
            <label>
              Customer email
              <input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} />
            </label>
            <label>
              Customer name
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            </label>
            <label>
              Discount code
              <input value={form.discountCode} onChange={(e) => setForm({ ...form, discountCode: e.target.value })} />
            </label>
            <label>
              Note
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
          </div>
          <div className="actions">
            <span className="muted">Subtotal before discount: {formatMoney(estimate, store.currency)}</span>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saveMutation.isPending || form.lines.length === 0}>
                Save draft
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="panel flush">
        {draftsQuery.error ? <div className="notice">{draftsQuery.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Draft</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draftsQuery.data.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>#{d.id.slice(-6)}</strong>
                  <div className="muted">{formatDate(d.createdAt)}</div>
                </td>
                <td>{d.guestName ?? d.guestEmail ?? <span className="muted">No customer</span>}</td>
                <td>{d.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td>
                  {formatMoney(d.total, store.currency)}
                  {d.discountCode ? <div className="muted">{d.discountCode}</div> : null}
                </td>
                <td className="row-actions">
                  <button type="button" className="secondary" onClick={() => edit(d)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate({ id: d.id, markPaid: false }).catch(() => undefined)}
                  >
                    Create order
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate({ id: d.id, markPaid: true }).catch(() => undefined)}
                  >
                    Mark as paid
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => confirm('Delete this draft?') && deleteMutation.mutate(d.id).catch(() => undefined)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {draftsQuery.data.length === 0 ? <div className="empty">No draft orders. Create one to take an order by phone or chat.</div> : null}
      </div>
    </section>
  )
}
