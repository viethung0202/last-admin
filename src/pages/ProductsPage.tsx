import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { Collection, PageProps, Product, ProductCategory, ProductStatus } from '../lib/types'

type ProductForm = {
  name: string
  description: string
  price: string
  stock: string
  status: ProductStatus
  categorySlug: string
  collectionIds: string[]
}

const emptyForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  stock: '0',
  status: 'DRAFT',
  categorySlug: '',
  collectionIds: [],
}

export function ProductsPage({ store, token, notify }: PageProps) {
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductStatus>('ALL')
  const [newCollection, setNewCollection] = useState('')
  const base = `/stores/${store.slug}`

  const productsQuery = useQuery<Product[]>(
    ['products', store.slug],
    () => apiRequest(`${base}/products`, { token }),
    { initialData: [] },
  )
  const categoriesQuery = useQuery<ProductCategory[]>(
    ['catalog-categories'],
    () => apiRequest('/catalog/categories'),
    { initialData: [] },
  )
  const collectionsQuery = useQuery<Collection[]>(
    ['collections', store.slug],
    () => apiRequest(`${base}/collections`),
    { initialData: [] },
  )

  const saveMutation = useMutation<ProductForm, Product>(
    (input) =>
      apiRequest(editingId ? `${base}/products/${editingId}` : `${base}/products`, {
        method: editingId ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          price: input.price.trim(),
          stock: Number(input.stock),
          status: input.status,
          categorySlug: input.categorySlug || null,
          collectionIds: input.collectionIds,
        }),
      }),
    {
      onSuccess: async () => {
        notify(editingId ? 'Product updated' : 'Product created')
        setForm(emptyForm)
        setEditingId(null)
        await productsQuery.refetch()
      },
      onError: notify,
    },
  )

  const deleteMutation = useMutation<string, { deleted: boolean }>(
    (productId) => apiRequest(`${base}/products/${productId}`, { method: 'DELETE', token }),
    {
      onSuccess: async () => {
        notify('Product deleted')
        await productsQuery.refetch()
      },
      onError: notify,
    },
  )

  const createCollectionMutation = useMutation<string, Collection>(
    (name) =>
      apiRequest(`${base}/collections`, { method: 'POST', token, body: JSON.stringify({ name }) }),
    {
      onSuccess: async (collection) => {
        setNewCollection('')
        setForm((current) => ({
          ...current,
          collectionIds: [...current.collectionIds, collection.id],
        }))
        await collectionsQuery.refetch()
      },
      onError: notify,
    },
  )

  const busy = saveMutation.isPending || deleteMutation.isPending

  const filtered = productsQuery.data.filter(
    (product) =>
      product.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (statusFilter === 'ALL' || product.status === statusFilter),
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate(form).catch(() => undefined)
  }

  function edit(product: Product) {
    const variant = product.variants[0]
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: variant?.price ?? '',
      stock: String(variant?.stock ?? 0),
      status: product.status,
      categorySlug: product.category?.slug ?? '',
      collectionIds: product.collections.map((item) => item.collection.id),
    })
  }

  function remove(productId: string) {
    if (confirm('Delete this product?')) {
      deleteMutation.mutate(productId).catch(() => undefined)
    }
  }

  return (
    <section className="content-grid">
      <form onSubmit={submit} className="panel product-form">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>{editingId ? 'Edit product' : 'New product'}</h2>
        </div>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="two-col">
          <label>
            Price ({store.currency})
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label>
            Stock
            <input
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </label>
        </div>
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
        <label>
          Category
          <select
            value={form.categorySlug}
            onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
          >
            <option value="">Choose a product category</option>
            {categoriesQuery.data.map((category) => (
              <option value={category.slug} key={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <section className="sub-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Collections</p>
              <h3>Store grouping</h3>
            </div>
          </div>
          <div className="inline-form">
            <input
              value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)}
              placeholder="Summer picks"
            />
            <button
              type="button"
              disabled={createCollectionMutation.isPending || !newCollection.trim()}
              onClick={() => createCollectionMutation.mutate(newCollection).catch(() => undefined)}
            >
              Add
            </button>
          </div>
          <div className="check-list">
            {collectionsQuery.data.map((collection) => (
              <label className="check-row" key={collection.id}>
                <input
                  type="checkbox"
                  checked={form.collectionIds.includes(collection.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      collectionIds: e.target.checked
                        ? [...form.collectionIds, collection.id]
                        : form.collectionIds.filter((id) => id !== collection.id),
                    })
                  }
                />
                <span>{collection.name}</span>
              </label>
            ))}
            {collectionsQuery.data.length === 0 ? (
              <span className="muted">No collections yet.</span>
            ) : null}
          </div>
        </section>
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
                setForm(emptyForm)
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
            <h2>{filtered.length} items</h2>
          </div>
          <button type="button" className="secondary" onClick={() => productsQuery.refetch()}>
            {productsQuery.isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {productsQuery.error ? <div className="notice">{productsQuery.error}</div> : null}
        <div className="filterbar">
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name"
            />
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ProductStatus)}
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
        </div>
        <div className="table">
          {filtered.map((product) => {
            const variant = product.variants[0]
            return (
              <article className="product-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.description || 'No description'}</span>
                  <small>
                    {product.category?.name ?? 'No category'} ·{' '}
                    {product.collections.length
                      ? product.collections.map((item) => item.collection.name).join(', ')
                      : 'No collections'}
                  </small>
                </div>
                <span>{variant ? formatMoney(variant.price, store.currency) : '-'}</span>
                <span>{variant?.stock ?? 0} stock</span>
                <span className={product.status === 'ACTIVE' ? 'status active' : 'status'}>
                  {product.status}
                </span>
                <div className="row-actions">
                  <button type="button" onClick={() => edit(product)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => remove(product.id)}>
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
          {filtered.length === 0 ? (
            <div className="empty">
              {productsQuery.data.length === 0
                ? 'No products yet.'
                : 'No products match your filters.'}
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}
