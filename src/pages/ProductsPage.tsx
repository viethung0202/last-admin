import { useState } from 'react'
import { apiRequest, useQuery } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { PageProps, Product, ProductStatus } from '../lib/types'

// Price cell: single price or "min – max" across variants.
function priceRange(product: Product, currency: string) {
  const prices = product.variants.map((v) => Number(v.price))
  if (prices.length === 0) return '-'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
}

export function ProductsPage({ store, token }: PageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductStatus>('ALL')

  const productsQuery = useQuery<Product[]>(
    ['products', store.slug],
    () => apiRequest(`/stores/${store.slug}/products`, { token }),
    { initialData: [] },
  )

  const filtered = productsQuery.data.filter(
    (product) =>
      product.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (statusFilter === 'ALL' || product.status === statusFilter),
  )

  return (
    <section className="page">
      <div className="page-header">
        <h2>Products</h2>
        <a className="btn" href="#/products/new">
          Add product
        </a>
      </div>
      <div className="panel flush">
        <div className="toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
          <div className="segmented">
            {(['ALL', 'ACTIVE', 'DRAFT'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={statusFilter === value ? 'selected' : ''}
                onClick={() => setStatusFilter(value)}
              >
                {value === 'ALL' ? 'All' : value === 'ACTIVE' ? 'Active' : 'Draft'}
              </button>
            ))}
          </div>
        </div>
        {productsQuery.error ? <div className="notice">{productsQuery.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Inventory</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const stock = product.variants.reduce((sum, v) => sum + v.stock, 0)
              const image = product.images[0]
              return (
                <tr key={product.id} onClick={() => (location.hash = `#/products/${product.id}`)}>
                  <td>
                    <div className="product-cell">
                      {image ? (
                        <img className="thumb" src={image.url} alt={image.alt ?? ''} />
                      ) : (
                        <span className="thumb placeholder" />
                      )}
                      <a href={`#/products/${product.id}`}>{product.name}</a>
                    </div>
                  </td>
                  <td>
                    <span className={product.status === 'ACTIVE' ? 'badge success' : 'badge'}>
                      {product.status === 'ACTIVE' ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className={stock === 0 ? 'text-critical' : ''}>
                    {stock} in stock
                    {product.variants.length > 1 ? ` for ${product.variants.length} variants` : ''}
                  </td>
                  <td>{product.category?.name ?? '—'}</td>
                  <td>{product.vendor ?? '—'}</td>
                  <td>{priceRange(product, store.currency)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="empty">
            {productsQuery.isLoading
              ? 'Loading...'
              : productsQuery.data.length === 0
                ? 'No products yet. Add your first product to start selling.'
                : 'No products match your filters.'}
          </div>
        ) : null}
      </div>
    </section>
  )
}
