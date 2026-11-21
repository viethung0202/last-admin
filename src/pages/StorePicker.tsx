import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation } from '../lib/api'
import type { Store } from '../lib/types'

type Props = {
  token: string
  stores: Store[]
  onSelect: (store: Store) => void
  onCreated: (store: Store) => void
  notify: (message: string) => void
}

export function StorePicker({ token, stores, onSelect, onCreated, notify }: Props) {
  const [form, setForm] = useState({ name: '', slug: '', currency: 'VND' })
  const createMutation = useMutation<typeof form, Omit<Store, 'role'>>(
    (input) => apiRequest('/stores', { method: 'POST', token, body: JSON.stringify(input) }),
    {
      onSuccess: (store) => {
        setForm({ name: '', slug: '', currency: 'VND' })
        notify(`Store ${store.slug} is ready`)
        onCreated({ ...store, role: 'OWNER' })
      },
      onError: notify,
    },
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    createMutation.mutate(form).catch(() => undefined)
  }

  return (
    <section className="settings-stack">
      <section className="panel">
        <p className="eyebrow">Your stores</p>
        <h2>{stores.length ? 'Choose a store' : 'No stores yet'}</h2>
        <div className="table">
          {stores.map((store) => (
            <button
              type="button"
              className="customer-row"
              key={store.id}
              onClick={() => onSelect(store)}
            >
              <span>
                <strong>{store.name}</strong>
                <small>{store.domains.find((d) => d.isPrimary)?.hostname ?? store.slug}</small>
              </span>
              <span className="status">{store.role}</span>
            </button>
          ))}
        </div>
      </section>
      <form onSubmit={submit} className="panel">
        <p className="eyebrow">New store</p>
        <h2>Create a store</h2>
        <div className="form-row">
          <label>
            Store name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Hula Demo Store"
            />
          </label>
          <label>
            Slug (subdomain)
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="hula-demo"
            />
          </label>
          <label>
            Currency
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {['VND', 'USD', 'EUR'].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={createMutation.isPending}>
            Create store
          </button>
        </div>
      </form>
    </section>
  )
}
