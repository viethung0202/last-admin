import { useState } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { Discount, PageProps } from '../lib/types'

type Form = {
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: string
  minSubtotal: string
  usageLimit: string
  startsAt: string
  endsAt: string
  active: boolean
}

const emptyForm: Form = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minSubtotal: '',
  usageLimit: '',
  startsAt: '',
  endsAt: '',
  active: true,
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time
const toLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''

export function DiscountsPage({ store, token, notify }: PageProps) {
  const base = `/stores/${store.slug}/discounts`
  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const query = useQuery<Discount[]>(['discounts', store.slug], () => apiRequest(base, { token }), {
    initialData: [],
  })

  const saveMutation = useMutation<Form, Discount>(
    (f) =>
      apiRequest(editingId ? `${base}/${editingId}` : base, {
        method: editingId ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify({
          code: f.code,
          type: f.type,
          value: f.value.trim(),
          minSubtotal: f.minSubtotal.trim() || null,
          usageLimit: f.usageLimit.trim() ? Number(f.usageLimit) : null,
          startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
          endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
          active: f.active,
        }),
      }),
    {
      onSuccess: async () => {
        notify('Discount saved')
        setForm(null)
        setEditingId(null)
        await query.refetch()
      },
      onError: notify,
    },
  )
  const deleteMutation = useMutation<string, unknown>(
    (id) => apiRequest(`${base}/${id}`, { method: 'DELETE', token }),
    {
      onSuccess: async () => {
        notify('Discount deleted')
        await query.refetch()
      },
      onError: notify,
    },
  )

  function edit(d: Discount) {
    setEditingId(d.id)
    setForm({
      code: d.code,
      type: d.type,
      value: d.value,
      minSubtotal: d.minSubtotal ?? '',
      usageLimit: d.usageLimit === null ? '' : String(d.usageLimit),
      startsAt: toLocal(d.startsAt),
      endsAt: toLocal(d.endsAt),
      active: d.active,
    })
  }

  const label = (d: Discount) =>
    d.type === 'PERCENTAGE' ? `${Number(d.value)}% off` : `${formatMoney(d.value, store.currency)} off`
  const state = (d: Discount) => {
    const now = Date.now()
    if (!d.active) return ['Disabled', 'badge'] as const
    if (d.endsAt && new Date(d.endsAt).getTime() < now) return ['Expired', 'badge critical'] as const
    if (d.startsAt && new Date(d.startsAt).getTime() > now) return ['Scheduled', 'badge'] as const
    if (d.usageLimit !== null && d.usedCount >= d.usageLimit) return ['Used up', 'badge critical'] as const
    return ['Active', 'badge success'] as const
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Discounts</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setForm(emptyForm)
          }}
        >
          Create discount
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
          <h3 className="card-title">{editingId ? 'Edit discount' : 'New discount code'}</h3>
          <label>
            Discount code
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER10" />
          </label>
          <div className="two-col">
            <label>
              Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form['type'] })}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount ({store.currency})</option>
              </select>
            </label>
            <label>
              Value
              <input inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </label>
            <label>
              Minimum order ({store.currency})
              <input inputMode="decimal" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </label>
            <label>
              Usage limit
              <input inputMode="numeric" value={form.usageLimit} placeholder="Unlimited" onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </label>
            <label>
              Starts
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label>
              Ends
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Active</span>
          </label>
          <div className="actions end">
            <button type="button" className="secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" disabled={saveMutation.isPending}>
              Save discount
            </button>
          </div>
        </form>
      ) : null}

      <div className="panel flush">
        {query.error ? <div className="notice">{query.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Discount</th>
              <th>Used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((d) => {
              const [text, cls] = state(d)
              return (
                <tr key={d.id}>
                  <td>
                    <strong>{d.code}</strong>
                    {d.minSubtotal ? <div className="muted">Min. {formatMoney(d.minSubtotal, store.currency)}</div> : null}
                  </td>
                  <td>
                    <span className={cls}>{text}</span>
                  </td>
                  <td>{label(d)}</td>
                  <td>
                    {d.usedCount}
                    {d.usageLimit !== null ? ` / ${d.usageLimit}` : ''}
                  </td>
                  <td className="row-actions">
                    <button type="button" className="secondary" onClick={() => edit(d)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => confirm(`Delete ${d.code}?`) && deleteMutation.mutate(d.id).catch(() => undefined)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {query.data.length === 0 ? (
          <div className="empty">No discount codes yet. Create one to offer customers a percentage or fixed amount off.</div>
        ) : null}
      </div>
    </section>
  )
}
