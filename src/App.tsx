import { useEffect, useState } from 'react'
import { FileEdit, Home, Layers, Percent, Settings, ShoppingCart, Tag, Users } from 'lucide-react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from './lib/api'
import { readStorage } from './lib/format'
import type { PageProps, Store, User } from './lib/types'
import { CollectionsPage } from './pages/CollectionsPage'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { DiscountsPage } from './pages/DiscountsPage'
import { DraftOrdersPage } from './pages/DraftOrdersPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditorPage } from './pages/ProductEditorPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StorePicker } from './pages/StorePicker'
import './App.css'

const NAV = [
  ['dashboard', 'Home', Home, false],
  ['orders', 'Orders', ShoppingCart, false],
  ['drafts', 'Drafts', FileEdit, true],
  ['products', 'Products', Tag, false],
  ['collections', 'Collections', Layers, true],
  ['customers', 'Customers', Users, false],
  ['discounts', 'Discounts', Percent, false],
  ['settings', 'Settings', Settings, false],
] as const

type Tab = (typeof NAV)[number][0]

// #/orders -> {tab:'orders'}, #/products/abc -> {tab:'products', param:'abc'}
// keeps the page on refresh and makes links like href="#/orders" work
function routeFromHash(): { tab: Tab; param?: string } {
  const [tab, param] = location.hash.replace(/^#\/?/, '').split('/')
  return NAV.some(([key]) => key === tab) ? { tab: tab as Tab, param } : { tab: 'dashboard' }
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('hula.token') ?? '')
  const [user, setUser] = useState<User | null>(() => readStorage('hula.user'))
  const [storeSlug, setStoreSlug] = useState(() => localStorage.getItem('hula.storeSlug') ?? '')
  const [route, setRoute] = useState(routeFromHash)
  const { tab, param } = route
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
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

  const pageProps: PageProps | null = store ? { store, token, notify: setMessage, param } : null

  const signedInStore = Boolean(user && token && store)
  return (
    <div className={signedInStore ? 'app-shell' : 'app-shell bare'}>
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark">H</span>
          <span>Hula</span>
        </a>
        <span className="topbar-store">{store ? store.name : ''}</span>
        {user ? (
          <div className="account">
            {store ? (
              <button type="button" className="ghost" onClick={() => selectStore(null)}>
                Switch store
              </button>
            ) : null}
            <span className="avatar" title={user.email}>
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <button type="button" className="ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {signedInStore ? (
        <aside className="sidebar">
          <nav>
            {NAV.map(([key, label, Icon, sub]) => (
              <a
                key={key}
                href={`#/${key}`}
                className={`nav-item${sub ? ' sub' : ''}${tab === key ? ' active' : ''}`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </a>
            ))}
          </nav>
          {store ? (
            <div className="store-card">
              <strong>{store.domains.find((d) => d.isPrimary)?.hostname ?? store.slug}</strong>
              <span>{store.role === 'OWNER' ? 'Owner' : 'Staff'}</span>
            </div>
          ) : null}
        </aside>
      ) : null}

      <main className="workspace">
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
            {tab === 'products' && param ? <ProductEditorPage key={param} {...pageProps} /> : null}
            {tab === 'products' && !param ? <ProductsPage {...pageProps} /> : null}
            {tab === 'drafts' ? <DraftOrdersPage {...pageProps} /> : null}
            {tab === 'discounts' ? <DiscountsPage {...pageProps} /> : null}
            {tab === 'collections' ? <CollectionsPage {...pageProps} /> : null}
            {tab === 'orders' ? <OrdersPage {...pageProps} /> : null}
            {tab === 'customers' ? <CustomersPage {...pageProps} /> : null}
            {tab === 'settings' ? <SettingsPage {...pageProps} onStoreUpdated={upsertStore} /> : null}
          </div>
        )}
      </main>
    </div>
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
