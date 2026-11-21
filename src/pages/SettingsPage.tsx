import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import type { Domain, Member, PageProps, PaymentMethods, Role, Store } from '../lib/types'

type Props = PageProps & { onStoreUpdated: (store: Store) => void }

export function SettingsPage({ store, token, notify, onStoreUpdated }: Props) {
  const isOwner = store.role === 'OWNER'
  return (
    <section className="settings-stack">
      {!isOwner ? (
        <div className="notice">Only the store owner can change settings. You have STAFF access.</div>
      ) : null}
      <GeneralSettings {...{ store, token, notify, onStoreUpdated, isOwner }} />
      <DomainSettings {...{ store, token, notify, isOwner, onStoreUpdated }} />
      <StaffSettings {...{ store, token, notify, isOwner }} />
      <PaymentSettings {...{ store, token, notify, isOwner }} />
    </section>
  )
}

type SectionProps = PageProps & { isOwner: boolean }

function GeneralSettings({
  store,
  token,
  notify,
  onStoreUpdated,
  isOwner,
}: SectionProps & { onStoreUpdated: (store: Store) => void }) {
  const [form, setForm] = useState({ name: store.name, currency: store.currency })
  const saveMutation = useMutation<typeof form, Omit<Store, 'role'>>(
    (input) =>
      apiRequest(`/stores/${store.slug}`, { method: 'PATCH', token, body: JSON.stringify(input) }),
    {
      onSuccess: (saved) => {
        onStoreUpdated({ ...saved, role: store.role })
        notify('Store settings saved')
      },
      onError: notify,
    },
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate(form).catch(() => undefined)
  }

  return (
    <form className="panel settings-panel" onSubmit={submit}>
      <p className="eyebrow">General</p>
      <h2>Store details</h2>
      <div className="form-row">
        <label>
          Store name
          <input
            value={form.name}
            disabled={!isOwner}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Currency
          <select
            value={form.currency}
            disabled={!isOwner}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {['VND', 'USD', 'EUR'].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!isOwner || saveMutation.isPending}>
          Save
        </button>
      </div>
      <small className="muted">
        Slug <strong>{store.slug}</strong> is fixed: it is the default storefront subdomain.
        Changing currency does not convert existing prices.
      </small>
    </form>
  )
}

function DomainSettings({
  store,
  token,
  notify,
  isOwner,
  onStoreUpdated,
}: SectionProps & { onStoreUpdated: (store: Store) => void }) {
  const [hostname, setHostname] = useState('')
  const base = `/stores/${store.slug}/domains`
  const domainsQuery = useQuery<Domain[]>(
    ['domains', store.slug],
    () => apiRequest(base, { token }),
    { initialData: [] },
  )
  const domainMutation = useMutation<
    { action: 'add' | 'primary' | 'remove'; id?: string },
    Domain | Domain[]
  >(
    ({ action, id }) =>
      action === 'add'
        ? apiRequest(base, { method: 'POST', token, body: JSON.stringify({ hostname }) })
        : apiRequest(action === 'primary' ? `${base}/${id}/primary` : `${base}/${id}`, {
            method: action === 'primary' ? 'POST' : 'DELETE',
            token,
          }),
    {
      onSuccess: async (_data, input) => {
        if (input.action === 'add') {
          setHostname('')
        }
        notify('Domains updated')
        // keep the topbar's primary hostname in sync
        onStoreUpdated({ ...store, domains: await apiRequest<Domain[]>(base, { token }) })
        await domainsQuery.refetch()
      },
      onError: notify,
    },
  )

  return (
    <section className="panel settings-panel">
      <p className="eyebrow">Domains</p>
      <h2>Where customers find the store</h2>
      <div className="table">
        {domainsQuery.data.map((domain) => (
          <div className="list-row" key={domain.id}>
            <div>
              <strong>{domain.hostname}</strong>
              {domain.isPrimary ? <span className="status active">Primary</span> : null}
            </div>
            {isOwner && !domain.isPrimary ? (
              <div className="row-actions">
                <button
                  type="button"
                  onClick={() => domainMutation.mutate({ action: 'primary', id: domain.id }).catch(() => undefined)}
                >
                  Make primary
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => domainMutation.mutate({ action: 'remove', id: domain.id }).catch(() => undefined)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {isOwner ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            domainMutation.mutate({ action: 'add' }).catch(() => undefined)
          }}
        >
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="shop.yourbrand.com"
          />
          <button type="submit" disabled={domainMutation.isPending || !hostname.trim()}>
            Add domain
          </button>
        </form>
      ) : null}
      <small className="muted">
        Custom domains are recorded here; pointing DNS and issuing TLS for them is outside the demo scope.
      </small>
    </section>
  )
}

function StaffSettings({ store, token, notify, isOwner }: SectionProps) {
  const [form, setForm] = useState<{ email: string; role: Role }>({ email: '', role: 'STAFF' })
  const base = `/stores/${store.slug}/members`
  const membersQuery = useQuery<Member[]>(
    ['members', store.slug],
    () => apiRequest(base, { token }),
    { initialData: [] },
  )
  const memberMutation = useMutation<
    { action: 'add' } | { action: 'role'; userId: string; role: Role } | { action: 'remove'; userId: string },
    Member[]
  >(
    (input) =>
      input.action === 'add'
        ? apiRequest(base, { method: 'POST', token, body: JSON.stringify(form) })
        : input.action === 'role'
          ? apiRequest(`${base}/${input.userId}`, {
              method: 'PATCH',
              token,
              body: JSON.stringify({ role: input.role }),
            })
          : apiRequest(`${base}/${input.userId}`, { method: 'DELETE', token }),
    {
      onSuccess: (members, input) => {
        membersQuery.setData(members)
        if (input.action === 'add') {
          setForm({ email: '', role: 'STAFF' })
        }
        notify('Staff updated')
      },
      onError: notify,
    },
  )

  return (
    <section className="panel settings-panel">
      <p className="eyebrow">Staff &amp; permissions</p>
      <h2>Who can manage this store</h2>
      <div className="table">
        {membersQuery.data.map((member) => (
          <div className="list-row" key={member.userId}>
            <div>
              <strong>{member.user.name}</strong>
              <span>{member.user.email}</span>
            </div>
            <select
              value={member.role}
              disabled={!isOwner || memberMutation.isPending}
              onChange={(e) =>
                memberMutation
                  .mutate({ action: 'role', userId: member.userId, role: e.target.value as Role })
                  .catch(() => undefined)
              }
            >
              <option value="OWNER">Owner</option>
              <option value="STAFF">Staff</option>
            </select>
            {isOwner ? (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (confirm(`Remove ${member.user.email} from this store?`)) {
                    memberMutation.mutate({ action: 'remove', userId: member.userId }).catch(() => undefined)
                  }
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {isOwner ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            memberMutation.mutate({ action: 'add' }).catch(() => undefined)
          }}
        >
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="teammate@email.com"
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="STAFF">Staff</option>
            <option value="OWNER">Owner</option>
          </select>
          <button type="submit" disabled={memberMutation.isPending || !form.email.trim()}>
            Add
          </button>
        </form>
      ) : null}
      <small className="muted">
        Staff manage products, collections, orders and customers. Owners also manage settings,
        domains, staff and payments. The person must register a Hula account first.
      </small>
    </section>
  )
}

function PaymentSettings({ store, token, notify, isOwner }: SectionProps) {
  const base = `/stores/${store.slug}/payment-methods`
  const methodsQuery = useQuery<PaymentMethods>(
    ['payment-methods', store.slug],
    () => apiRequest(base),
    { initialData: { COD: false, VNPAY: false, vnpayAvailable: false } },
  )
  const saveMutation = useMutation<Partial<Record<'COD' | 'VNPAY', boolean>>, PaymentMethods>(
    (input) => apiRequest(base, { method: 'PUT', token, body: JSON.stringify(input) }),
    {
      onSuccess: (data) => {
        methodsQuery.setData(data)
        notify('Payment methods saved')
      },
      onError: notify,
    },
  )
  const methods = methodsQuery.data

  return (
    <section className="panel settings-panel">
      <p className="eyebrow">Payments</p>
      <h2>Checkout methods</h2>
      <div className="check-list">
        <label className="check-row">
          <input
            type="checkbox"
            checked={methods.COD}
            disabled={!isOwner || saveMutation.isPending}
            onChange={(e) => saveMutation.mutate({ COD: e.target.checked }).catch(() => undefined)}
          />
          <span>Cash on delivery (COD)</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={methods.VNPAY}
            disabled={!isOwner || saveMutation.isPending || !methods.vnpayAvailable}
            onChange={(e) => saveMutation.mutate({ VNPAY: e.target.checked }).catch(() => undefined)}
          />
          <span>VNPAY Sandbox</span>
        </label>
        {!methods.vnpayAvailable ? (
          <small className="muted">VNPAY needs a VND store and platform VNPAY config.</small>
        ) : null}
      </div>
    </section>
  )
}
