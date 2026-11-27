import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatDate } from '../lib/format'
import type { PlatformMerchant, PlatformStats, PlatformStore, TemplateSummary, VnpaySettings } from '../lib/types'
import { starterHome } from '../builder/sections'

type Props = { token: string; notify: (message: string) => void; section?: string }

const SECTIONS = [
  ['stores', 'Stores'],
  ['merchants', 'Merchants'],
  ['templates', 'Templates'],
  ['payments', 'Payments'],
] as const

// Platform admin (operator of the SaaS): lock stores, see merchants, curate templates, shared VNPAY account.
export function PlatformPage({ token, notify, section = 'stores' }: Props) {
  const stats = useQuery<PlatformStats | null>(['platform-stats', token], () => apiRequest('/platform/stats', { token }), { initialData: null })
  const s = stats.data
  return (
    <section className="page">
      <div className="page-header">
        <h2>Platform admin</h2>
      </div>
      {s ? (
        <div className="stats-grid">
          {[
            ['Stores', s.stores, s.suspended ? `${s.suspended} suspended` : ''],
            ['Merchants', s.merchants, ''],
            ['Orders', s.orders, 'all stores'],
            ['Templates', s.templates, ''],
          ].map(([label, value, hint]) => (
            <div className="panel stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              {hint ? <small>{hint}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="segmented">
        {SECTIONS.map(([key, label]) => (
          <button key={key} type="button" className={section === key ? 'selected' : ''} onClick={() => (location.hash = `#/platform/${key}`)}>
            {label}
          </button>
        ))}
      </div>
      {section === 'stores' ? <Stores token={token} notify={notify} onChange={stats.refetch} /> : null}
      {section === 'merchants' ? <Merchants token={token} /> : null}
      {section === 'templates' ? <Templates token={token} notify={notify} onChange={stats.refetch} /> : null}
      {section === 'payments' ? <Payments token={token} notify={notify} /> : null}
    </section>
  )
}

function Stores({ token, notify, onChange }: Omit<Props, 'section'> & { onChange: () => void }) {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const query = useQuery<PlatformStore[]>(['platform-stores', search], () => apiRequest(`/platform/stores?q=${encodeURIComponent(search)}`, { token }), {
    initialData: [],
  })
  const statusMutation = useMutation<{ id: string; status: string }, unknown>(
    ({ id, status }) => apiRequest(`/platform/stores/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status }) }),
    {
      onSuccess: async (_, { status }) => {
        notify(status === 'SUSPENDED' ? 'Store suspended' : 'Store activated')
        await query.refetch()
        onChange()
      },
      onError: notify,
    },
  )
  return (
    <>
      <form
        className="panel inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q.trim())
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by store name or slug" aria-label="Search stores" />
        <button type="submit" className="secondary">
          Search
        </button>
      </form>
      <div className="panel flush">
        {query.error ? <div className="notice">{query.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Owner</th>
              <th>Products</th>
              <th>Orders</th>
              <th>Created</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((store) => (
              <tr key={store.id}>
                <td>
                  <strong>{store.name}</strong>
                  <div className="muted">{store.slug}</div>
                </td>
                <td className="muted">{store.owners.map((o) => o.email).join(', ')}</td>
                <td>{store.productCount}</td>
                <td>{store.orderCount}</td>
                <td className="muted">{formatDate(store.createdAt)}</td>
                <td>
                  <span className={store.status === 'ACTIVE' ? 'badge success' : 'badge critical'}>{store.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span>
                </td>
                <td className="row-actions">
                  {store.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="danger"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        confirm(`Suspend "${store.name}"? Shoppers will see the store as closed.`) &&
                        statusMutation.mutate({ id: store.id, status: 'SUSPENDED' }).catch(() => undefined)
                      }
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: store.id, status: 'ACTIVE' }).catch(() => undefined)}
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data.length === 0 && !query.isLoading ? <div className="empty">No stores found.</div> : null}
      </div>
    </>
  )
}

function Merchants({ token }: { token: string }) {
  const query = useQuery<PlatformMerchant[]>(['platform-merchants'], () => apiRequest('/platform/merchants', { token }), { initialData: [] })
  return (
    <div className="panel flush">
      {query.error ? <div className="notice">{query.error}</div> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Merchant</th>
            <th>Stores</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {query.data.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.name}</strong>
                <div className="muted">{m.email}</div>
              </td>
              <td className="muted">
                {m.stores.length ? m.stores.map((s) => `${s.name} (${s.role === 'OWNER' ? 'owner' : 'staff'}${s.status === 'SUSPENDED' ? ', suspended' : ''})`).join(', ') : '—'}
              </td>
              <td className="muted">{formatDate(m.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const EMPTY_TEMPLATE = { id: '', name: '', category: '', thumbnailUrl: '', description: '' }

function Templates({ token, notify, onChange }: Omit<Props, 'section'> & { onChange: () => void }) {
  const query = useQuery<TemplateSummary[]>(['platform-templates'], () => apiRequest('/platform/templates', { token }), { initialData: [] })
  const [form, setForm] = useState(EMPTY_TEMPLATE)
  const refresh = async () => {
    await query.refetch()
    onChange()
  }
  const saveMutation = useMutation<typeof form, TemplateSummary>(
    ({ id, ...input }) =>
      id
        ? apiRequest(`/platform/templates/${id}`, { method: 'PUT', token, body: JSON.stringify(input) })
        : apiRequest('/platform/templates', { method: 'POST', token, body: JSON.stringify({ ...input, data: starterHome() }) }),
    {
      onSuccess: async (t, input) => {
        setForm(EMPTY_TEMPLATE)
        if (input.id) {
          notify('Template updated')
          await refresh()
        } else location.hash = `#/platform/templates/${t.id}`
      },
      onError: notify,
    },
  )
  const patchMutation = useMutation<{ id: string; published: boolean }, unknown>(
    ({ id, published }) => apiRequest(`/platform/templates/${id}`, { method: 'PUT', token, body: JSON.stringify({ published }) }),
    { onSuccess: refresh, onError: notify },
  )
  const deleteMutation = useMutation<string, unknown>((id) => apiRequest(`/platform/templates/${id}`, { method: 'DELETE', token }), {
    onSuccess: async () => {
      notify('Template deleted')
      await refresh()
    },
    onError: notify,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate(form).catch(() => undefined)
  }

  return (
    <>
      <form className="panel form-grid" onSubmit={submit}>
        <h3>{form.id ? 'Edit template details' : 'New template'}</h3>
        <label>
          Template name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fashion boutique" />
        </label>
        <label>
          Category
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fashion, Food, Electronics..." />
        </label>
        <label>
          Thumbnail URL
          <input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </label>
        <div className="actions">
          <button type="submit" disabled={!form.name.trim() || saveMutation.isPending}>
            {form.id ? 'Save details' : 'Create and design'}
          </button>
          {form.id ? (
            <button type="button" className="secondary" onClick={() => setForm(EMPTY_TEMPLATE)}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <div className="panel flush">
        {query.error ? <div className="notice">{query.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Category</th>
              <th>Source</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="thumb-cell">
                    {t.thumbnailUrl ? <img src={t.thumbnailUrl} alt="" /> : null}
                    <a href={`#/platform/templates/${t.id}`}>
                      <strong>{t.name}</strong>
                    </a>
                  </div>
                </td>
                <td className="muted">{t.category ?? '—'}</td>
                <td className="muted">{t.source === 'AI' ? 'AI' : 'Platform'}</td>
                <td>{t.published ? <span className="badge success">Published</span> : <span className="badge">Hidden</span>}</td>
                <td className="muted">{t.updatedAt ? formatDate(t.updatedAt) : ''}</td>
                <td className="row-actions">
                  <a className="btn" href={`#/platform/templates/${t.id}`}>
                    Design
                  </a>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setForm({ id: t.id, name: t.name, category: t.category ?? '', thumbnailUrl: t.thumbnailUrl ?? '', description: t.description ?? '' })
                    }
                  >
                    Details
                  </button>
                  <button type="button" className="secondary" onClick={() => patchMutation.mutate({ id: t.id, published: !t.published }).catch(() => undefined)}>
                    {t.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => confirm(`Delete template "${t.name}"? Pages already made from it are kept.`) && deleteMutation.mutate(t.id).catch(() => undefined)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data.length === 0 && !query.isLoading ? <div className="empty">No templates yet. Merchants only see published templates.</div> : null}
      </div>
    </>
  )
}

function Payments({ token, notify }: Omit<Props, 'section'>) {
  const [form, setForm] = useState({ tmnCode: '', hashSecret: '', payUrl: '' })
  const query = useQuery<VnpaySettings | null>(
    ['platform-vnpay'],
    async () => {
      const data = await apiRequest<VnpaySettings>('/platform/settings/vnpay', { token })
      setForm({ tmnCode: data.tmnCode, hashSecret: '', payUrl: data.payUrl })
      return data
    },
    { initialData: null },
  )
  const saveMutation = useMutation<typeof form, VnpaySettings>(
    (input) => apiRequest('/platform/settings/vnpay', { method: 'PUT', token, body: JSON.stringify(input) }),
    {
      onSuccess: (data) => {
        query.setData(data)
        setForm({ tmnCode: data.tmnCode, hashSecret: '', payUrl: data.payUrl })
        notify(data.tmnCode ? 'VNPAY settings saved' : 'VNPAY settings cleared')
      },
      onError: notify,
    },
  )
  const v = query.data
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault()
        saveMutation.mutate(form).catch(() => undefined)
      }}
    >
      <h3>VNPAY merchant account</h3>
      <p className="muted">
        One VNPAY account is shared by all stores. Stores turn VNPAY on or off in their own settings.
        {v?.envFallback ? ' Currently using the server environment config.' : ''}
      </p>
      <label>
        TMN code
        <input value={form.tmnCode} onChange={(e) => setForm({ ...form, tmnCode: e.target.value })} placeholder="Leave empty to use the server env config" />
      </label>
      <label>
        Hash secret
        <input
          type="password"
          autoComplete="off"
          value={form.hashSecret}
          onChange={(e) => setForm({ ...form, hashSecret: e.target.value })}
          placeholder={v?.hashSecretSet ? 'Saved. Leave empty to keep it' : 'Required'}
        />
      </label>
      <label>
        Payment URL
        <input value={form.payUrl} onChange={(e) => setForm({ ...form, payUrl: e.target.value })} placeholder="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" />
      </label>
      <button type="submit" className="fit" disabled={saveMutation.isPending}>
        Save
      </button>
    </form>
  )
}
