import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from './lib/api'
import { readStorage } from './lib/format'
import type { PageProps, Store, User } from './lib/types'
import { CollectionsPage } from './pages/CollectionsPage'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StorePicker } from './pages/StorePicker'
import './App.css'

const TABS = [
  ['dashboard', 'Dashboard'],
  ['products', 'Products'],
  ['collections', 'Collections'],
  ['orders', 'Orders'],
  ['customers', 'Customers'],
  ['settings', 'Settings'],
] as const

type Tab = (typeof TABS)[number][0]

// #/orders -> 'orders'; keeps the tab on refresh and makes links like href="#/orders" work
function tabFromHash(): Tab {
  const tab = location.hash.replace(/^#\/?/, '')
  return TABS.some(([key]) => key === tab) ? (tab as Tab) : 'dashboard'
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('hula.token') ?? '')
  const [user, setUser] = useState<User | null>(() => readStorage('hula.user'))
  const [storeSlug, setStoreSlug] = useState(() => localStorage.getItem('hula.storeSlug') ?? '')
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const storesQuery = useQuery<Store[]>(
    ['my-stores', token],
    () => apiRequest('/stores', { token }),
    { enabled: Boolean(token), initialData: [] },
  )
  const store = storesQuery.data.find((item) => item.slug === storeSlug) ?? null

  // expired/invalid token -> back to login
  useEffect(() => {
    if (storesQuery.error && /token/i.test(storesQuery.error)) {
      signOut()
    }
  }, [storesQuery.error])

  function selectStore(next: Store | null) {
    setStoreSlug(next?.slug ?? '')
    localStorage.setItem('hula.storeSlug', next?.slug ?? '')
    setMessage('')
  }

  function upsertStore(next: Store) {
    storesQuery.setData((current) => [
      ...current.filter((item) => item.id !== next.id),
      next,
    ])
    setStoreSlug(next.slug)
    localStorage.setItem('hula.storeSlug', next.slug)
  }

  function signOut() {
    setToken('')
    setUser(null)
    selectStore(null)
    storesQuery.setData([])
    localStorage.removeItem('hula.token')
    localStorage.removeItem('hula.user')
  }

  const pageProps: PageProps | null = store ? { store, token, notify: setMessage } : null

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Hula</p>
          <h1>Merchant Admin</h1>
        </div>
        {user && store ? (
          <nav>
            {TABS.map(([key, label]) => (
              <a key={key} href={`#/${key}`} className={tab === key ? 'nav-item active' : 'nav-item'}>
                {label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="intro">
            <strong>Build your online store</strong>
            <span>Create a Hula store, manage your catalog, and sell on your own subdomain.</span>
          </div>
        )}
        {user ? (
          <div className="account">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            {store ? (
              <button type="button" onClick={() => selectStore(null)}>
                Switch store
              </button>
            ) : null}
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{store ? TABS.find(([key]) => key === tab)?.[1] : 'Merchant access'}</p>
            <h2>{store ? store.name : user ? `Welcome, ${user.name}` : 'Run your store with Hula'}</h2>
          </div>
          {store ? (
            <span className="pill">
              {store.domains.find((d) => d.isPrimary)?.hostname ?? store.slug} · {store.role}
            </span>
          ) : null}
        </header>

        {message ? (
          <div className="notice" onClick={() => setMessage('')}>
            {message}
          </div>
        ) : null}

        {!user || !token ? (
          <AuthPanel
            onSignedIn={(data) => {
              setUser(data.user)
              setToken(data.token)
              localStorage.setItem('hula.user', JSON.stringify(data.user))
              localStorage.setItem('hula.token', data.token)
              setMessage(`Signed in as ${data.user.email}`)
            }}
            notify={setMessage}
          />
        ) : !pageProps ? (
          <StorePicker
            token={token}
            stores={storesQuery.data}
            onSelect={selectStore}
            onCreated={upsertStore}
            notify={setMessage}
          />
        ) : (
          <div key={pageProps.store.id}>
            {tab === 'dashboard' ? <DashboardPage {...pageProps} /> : null}
            {tab === 'products' ? <ProductsPage {...pageProps} /> : null}
            {tab === 'collections' ? <CollectionsPage {...pageProps} /> : null}
            {tab === 'orders' ? <OrdersPage {...pageProps} /> : null}
            {tab === 'customers' ? <CustomersPage {...pageProps} /> : null}
            {tab === 'settings' ? <SettingsPage {...pageProps} onStoreUpdated={upsertStore} /> : null}
          </div>
        )}
      </section>
    </main>
  )
}

function AuthPanel({
  onSignedIn,
  notify,
}: {
  onSignedIn: (data: { user: User; token: string }) => void
  notify: (message: string) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const authMutation = useMutation<typeof form, { user: User; token: string }>(
    (input) => apiRequest(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(input) }),
    { onSuccess: onSignedIn, onError: notify },
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    authMutation.mutate(form).catch(() => undefined)
  }

  return (
    <section className="panel auth-panel">
      <div>
        <p className="eyebrow">Access</p>
        <h2>{mode === 'login' ? 'Sign in' : 'Create merchant account'}</h2>
      </div>
      <div className="segmented">
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={mode === value ? 'selected' : ''}
            onClick={() => {
              setMode(value)
              setForm({ name: '', email: '', password: '' })
            }}
          >
            {value === 'login' ? 'Login' : 'Register'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="form-grid">
        {mode === 'register' ? (
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button type="submit" disabled={authMutation.isPending}>
          {authMutation.isPending ? 'Working...' : 'Continue'}
        </button>
      </form>
    </section>
  )
}

export default App
