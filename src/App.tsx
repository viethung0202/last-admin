import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from './lib/api'
import './App.css'

type User = {
  id: string
  email: string
  name: string
}

type Store = {
  id: string
  slug: string
  name: string
  isListedOnMarketplace: boolean
}

type Product = {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE'
  variants: Array<{
    id: string
    priceCents: number
    stock: number
  }>
}

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

type Order = {
  id: string
  guestEmail: string | null
  guestName: string | null
  status: OrderStatus
  totalCents: number
  createdAt: string
  items: Array<{
    id: string
    productNameSnapshot: string
    variantLabelSnapshot: string
    unitPriceCents: number
    quantity: number
  }>
}

type ProductForm = {
  name: string
  description: string
  priceCents: string
  stock: string
  status: 'DRAFT' | 'ACTIVE'
}

type AdminTab = 'products' | 'orders' | 'settings'

type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT'

const emptyProductForm: ProductForm = {
  name: '',
  description: '',
  priceCents: '',
  stock: '0',
  status: 'DRAFT',
}

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [token, setToken] = useState(() => localStorage.getItem('hula.token') ?? '')
  const [user, setUser] = useState<User | null>(() => readStorage('hula.user'))
  const [store, setStore] = useState<Store | null>(() => readStorage('hula.store'))
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [storeForm, setStoreForm] = useState({ name: '', slug: '' })
  const [storeSlug, setStoreSlug] = useState(store?.slug ?? '')
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('products')
  const [productSearch, setProductSearch] = useState('')
  const [productStatusFilter, setProductStatusFilter] =
    useState<ProductStatusFilter>('ALL')
  const [message, setMessage] = useState('')

  const productsQuery = useQuery<Product[]>(
    ['products', store?.slug],
    () => apiRequest<Product[]>(`/stores/${store?.slug}/products`, { token }),
    { enabled: Boolean(store), initialData: [] },
  )

  const ordersQuery = useQuery<Order[]>(
    ['orders', store?.slug],
    () => apiRequest<Order[]>(`/stores/${store?.slug}/orders`, { token }),
    { enabled: Boolean(store && token), initialData: [] },
  )

  const authMutation = useMutation<
    typeof authForm,
    { user: User; token: string }
  >(
    (input) =>
      apiRequest(`/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    {
      onSuccess: (data) => {
        setUser(data.user)
        setToken(data.token)
        localStorage.setItem('hula.user', JSON.stringify(data.user))
        localStorage.setItem('hula.token', data.token)
        setMessage(`Signed in as ${data.user.email}`)
      },
      onError: setMessage,
    },
  )

  const createStoreMutation = useMutation<typeof storeForm, Store>(
    (input) =>
      apiRequest('/stores', {
        method: 'POST',
        token,
        body: JSON.stringify(input),
      }),
    {
      onSuccess: (data) => {
        saveStore(data)
        setMessage(`Store ${data.slug} is ready`)
      },
      onError: setMessage,
    },
  )

  const openStoreMutation = useMutation<string, Store>(
    (slug) => apiRequest(`/stores/${slug.trim()}`),
    {
      onSuccess: (data) => {
        saveStore(data)
        setMessage(`Opened ${data.name}`)
      },
      onError: setMessage,
    },
  )

  const saveProductMutation = useMutation<ProductForm, Product>(
    (input) => {
      if (!store) {
        throw new Error('Select a store first')
      }
      const body = {
        name: input.name,
        description: input.description,
        priceCents: Number(input.priceCents),
        stock: Number(input.stock),
        status: input.status,
      }
      return apiRequest(
        editingId
          ? `/stores/${store.slug}/products/${editingId}`
          : `/stores/${store.slug}/products`,
        {
          method: editingId ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify(body),
        },
      )
    },
    {
      onSuccess: async () => {
        setMessage(editingId ? 'Product updated' : 'Product created')
        setProductForm(emptyProductForm)
        setEditingId(null)
        await productsQuery.refetch()
      },
      onError: setMessage,
    },
  )

  const deleteProductMutation = useMutation<string, { deleted: boolean }>(
    (productId) => {
      if (!store) {
        throw new Error('Select a store first')
      }
      return apiRequest(`/stores/${store.slug}/products/${productId}`, {
        method: 'DELETE',
        token,
      })
    },
    {
      onSuccess: async () => {
        setMessage('Product deleted')
        await productsQuery.refetch()
      },
      onError: setMessage,
    },
  )

  const updateOrderStatusMutation = useMutation<
    { orderId: string; status: OrderStatus },
    Order
  >(
    (input) => {
      if (!store) {
        throw new Error('Select a store first')
      }
      return apiRequest(`/stores/${store.slug}/orders/${input.orderId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: input.status }),
      })
    },
    {
      onSuccess: async () => {
        setMessage('Order status updated')
        await ordersQuery.refetch()
      },
      onError: setMessage,
    },
  )

  const busy =
    authMutation.isPending ||
    createStoreMutation.isPending ||
    openStoreMutation.isPending ||
    saveProductMutation.isPending ||
    deleteProductMutation.isPending ||
    updateOrderStatusMutation.isPending

  const filteredProducts = productsQuery.data.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(productSearch.trim().toLowerCase())
    const matchesStatus =
      productStatusFilter === 'ALL' || product.status === productStatusFilter
    return matchesSearch && matchesStatus
  })

  function submitAuth(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    authMutation.mutate(authForm).catch(() => undefined)
  }

  function createStore(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    createStoreMutation.mutate(storeForm).catch(() => undefined)
  }

  function openStore(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    openStoreMutation.mutate(storeSlug).catch(() => undefined)
  }

  function saveProduct(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    saveProductMutation.mutate(productForm).catch(() => undefined)
  }

  function deleteProduct(productId: string) {
    if (!confirm('Delete this product?')) {
      return
    }
    setMessage('')
    deleteProductMutation.mutate(productId).catch(() => undefined)
  }

  function updateOrderStatus(orderId: string, status: OrderStatus) {
    setMessage('')
    updateOrderStatusMutation.mutate({ orderId, status }).catch(() => undefined)
  }

  function editProduct(product: Product) {
    const variant = product.variants[0]
    setEditingId(product.id)
    setProductForm({
      name: product.name,
      description: product.description ?? '',
      priceCents: String(variant?.priceCents ?? ''),
      stock: String(variant?.stock ?? 0),
      status: product.status,
    })
  }

  function saveStore(data: Store) {
    setStore(data)
    setStoreSlug(data.slug)
    localStorage.setItem('hula.store', JSON.stringify(data))
  }

  function signOut() {
    setToken('')
    setUser(null)
    setStore(null)
    setAuthMode('login')
    setAuthForm({ name: '', email: '', password: '' })
    setStoreForm({ name: '', slug: '' })
    setStoreSlug('')
    setProductForm(emptyProductForm)
    setEditingId(null)
    setActiveTab('products')
    setProductSearch('')
    setProductStatusFilter('ALL')
    setMessage('')
    productsQuery.setData([])
    localStorage.removeItem('hula.token')
    localStorage.removeItem('hula.user')
    localStorage.removeItem('hula.store')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Hula</p>
          <h1>Merchant Admin</h1>
        </div>
        {user ? (
          <nav>
            <button
              type="button"
              className={activeTab === 'products' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('products')}
            >
              Products
            </button>
            <button
              type="button"
              className={activeTab === 'orders' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('orders')}
            >
              Orders
            </button>
            <button
              type="button"
              className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('settings')}
            >
              Store settings
            </button>
          </nav>
        ) : (
          <div className="intro">
            <strong>Build your online store</strong>
            <span>
              Create a Hula store, manage your catalog, and publish products to
              your own storefront.
            </span>
          </div>
        )}
        {user ? (
          <div className="account">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{user ? 'Workspace' : 'Merchant access'}</p>
            <h2>
              {store
                ? store.name
                : user
                  ? `Welcome, ${user.name}`
                  : 'Run your store with Hula'}
            </h2>
          </div>
          {store ? <span className="pill">/{store.slug}</span> : null}
        </header>

        {message || productsQuery.error ? (
          <div className="notice">{message || productsQuery.error}</div>
        ) : null}

        {!user ? (
          <section className="panel auth-panel">
            <div>
              <p className="eyebrow">Access</p>
              <h2>{authMode === 'login' ? 'Sign in' : 'Create merchant account'}</h2>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={authMode === 'login' ? 'selected' : ''}
                onClick={() => {
                  setAuthMode('login')
                  setAuthForm({ name: '', email: '', password: '' })
                  setMessage('')
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'selected' : ''}
                onClick={() => {
                  setAuthMode('register')
                  setAuthForm({ name: '', email: '', password: '' })
                  setMessage('')
                }}
              >
                Register
              </button>
            </div>
            <form onSubmit={submitAuth} className="form-grid">
              {authMode === 'register' ? (
                <label>
                  Name
                  <input
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, name: event.target.value })
                    }
                  />
                </label>
              ) : null}
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? 'Working...' : 'Continue'}
              </button>
            </form>
          </section>
        ) : (
          <>
            {!store ? (
              <section className="welcome-grid">
                <div className="panel welcome-panel">
                  <p className="eyebrow">You are signed in</p>
                  <h2>Create or open a store</h2>
                  <p>
                    Products, orders, and settings appear after a store is selected.
                  </p>
                </div>
                <div className="panel stat-panel">
                  <strong>Next step</strong>
                  <span>Use the form below to create your first store.</span>
                </div>
              </section>
            ) : null}

            <section className="panel store-panel">
              <form onSubmit={createStore} className="form-row">
                <label>
                  Store name
                  <input
                    value={storeForm.name}
                    onChange={(event) =>
                      setStoreForm({ ...storeForm, name: event.target.value })
                    }
                    placeholder="Hula Demo Store"
                  />
                </label>
                <label>
                  Slug
                  <input
                    value={storeForm.slug}
                    onChange={(event) =>
                      setStoreForm({ ...storeForm, slug: event.target.value })
                    }
                    placeholder="hula-demo"
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Create store
                </button>
              </form>
              <form onSubmit={openStore} className="form-row compact">
                <label>
                  Open existing slug
                  <input
                    value={storeSlug}
                    onChange={(event) => setStoreSlug(event.target.value)}
                    placeholder="store-slug"
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Open
                </button>
              </form>
            </section>

            {store && activeTab === 'products' ? (
              <section className="content-grid">
                <form onSubmit={saveProduct} className="panel product-form">
                  <div>
                    <p className="eyebrow">Catalog</p>
                    <h2>{editingId ? 'Edit product' : 'New product'}</h2>
                  </div>
                  <label>
                    Name
                    <input
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm({ ...productForm, name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={productForm.description}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="two-col">
                    <label>
                      Price cents
                      <input
                        inputMode="numeric"
                        value={productForm.priceCents}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            priceCents: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Stock
                      <input
                        inputMode="numeric"
                        value={productForm.stock}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            stock: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Status
                    <select
                      value={productForm.status}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          status: event.target.value as ProductForm['status'],
                        })
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                    </select>
                  </label>
                  <div className="actions">
                    <button type="submit" disabled={busy}>
                      {editingId ? 'Save product' : 'Create product'}
                    </button>
                    {editingId ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setEditingId(null)
                          setProductForm(emptyProductForm)
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>

                <section className="panel product-list">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Products</p>
                      <h2>{filteredProducts.length} items</h2>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => productsQuery.refetch()}
                    >
                      {productsQuery.isLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="filterbar">
                    <label>
                      Search
                      <input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Search product name"
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={productStatusFilter}
                        onChange={(event) =>
                          setProductStatusFilter(
                            event.target.value as ProductStatusFilter,
                          )
                        }
                      >
                        <option value="ALL">All</option>
                        <option value="ACTIVE">Active</option>
                        <option value="DRAFT">Draft</option>
                      </select>
                    </label>
                  </div>
                  <div className="table">
                    {filteredProducts.map((product) => {
                      const variant = product.variants[0]
                      return (
                        <article className="product-row" key={product.id}>
                          <div>
                            <strong>{product.name}</strong>
                            <span>{product.description || 'No description'}</span>
                          </div>
                          <span>{variant ? formatMoney(variant.priceCents) : '-'}</span>
                          <span>{variant?.stock ?? 0} stock</span>
                          <span className={product.status === 'ACTIVE' ? 'status active' : 'status'}>
                            {product.status}
                          </span>
                          <div className="row-actions">
                            <button type="button" onClick={() => editProduct(product)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => deleteProduct(product.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      )
                    })}
                    {filteredProducts.length === 0 ? (
                      <div className="empty">
                        {productsQuery.data.length === 0
                          ? 'No products yet.'
                          : 'No products match your filters.'}
                      </div>
                    ) : null}
                  </div>
                </section>
              </section>
            ) : null}

            {store && activeTab === 'orders' ? (
              <section className="panel order-list">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Orders</p>
                    <h2>{ordersQuery.data.length} orders</h2>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => ordersQuery.refetch()}
                  >
                    {ordersQuery.isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                <div className="table">
                  {ordersQuery.data.map((order) => (
                    <article className="order-row" key={order.id}>
                      <div>
                        <strong>{order.guestName ?? 'Guest customer'}</strong>
                        <span>{order.guestEmail ?? 'No email'}</span>
                        <span>{order.items.length} item lines</span>
                      </div>
                      <span>{formatMoney(order.totalCents)}</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          updateOrderStatus(order.id, event.target.value as OrderStatus)
                        }
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </article>
                  ))}
                  {ordersQuery.data.length === 0 ? (
                    <div className="empty">
                      No orders yet. Storefront checkout will create them here.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {store && activeTab === 'settings' ? (
              <section className="settings-grid">
                <div className="panel settings-panel">
                  <p className="eyebrow">Store settings</p>
                  <h2>{store.name}</h2>
                  <div className="settings-list">
                    <div>
                      <span>Store slug</span>
                      <strong>/{store.slug}</strong>
                    </div>
                    <div>
                      <span>Mosaic visibility</span>
                      <strong>
                        {store.isListedOnMarketplace ? 'Listed' : 'Not listed'}
                      </strong>
                    </div>
                  </div>
                </div>
                <div className="panel empty-state">
                  <p className="eyebrow">Coming next</p>
                  <h2>Edit settings</h2>
                  <p>
                    The next backend step will add saving for store name, Mosaic
                    visibility, and theme basics.
                  </p>
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}

function readStorage<T>(key: string): T | null {
  const saved = localStorage.getItem(key)
  return saved ? JSON.parse(saved) : null
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default App
