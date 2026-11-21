import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { Collection, PageProps, Product, ProductCategory, ProductStatus } from '../lib/types'

type Row = {
  id?: string
  sku: string
  price: string
  compareAtPrice: string
  stock: string
  optionValues: Record<string, string>
}
type Option = { name: string; values: string[] }
type Form = {
  name: string
  description: string
  vendor: string
  tags: string
  seoTitle: string
  seoDescription: string
  status: ProductStatus
  categorySlug: string
  collectionIds: string[]
  images: Array<{ url: string; alt: string }>
  options: Option[]
  variants: Row[]
}

const blankRow = (): Row => ({ sku: '', price: '', compareAtPrice: '', stock: '0', optionValues: {} })
const emptyForm: Form = {
  name: '',
  description: '',
  vendor: '',
  tags: '',
  seoTitle: '',
  seoDescription: '',
  status: 'DRAFT',
  categorySlug: '',
  collectionIds: [],
  images: [],
  options: [],
  variants: [blankRow()],
}

function toForm(p: Product): Form {
  return {
    name: p.name,
    description: p.description ?? '',
    vendor: p.vendor ?? '',
    tags: p.tags.join(', '),
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    status: p.status,
    categorySlug: p.category?.slug ?? '',
    collectionIds: p.collections.map((c) => c.collection.id),
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? '' })),
    options: p.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.value) })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku ?? '',
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? '',
      stock: String(v.stock),
      optionValues: v.optionValues,
    })),
  }
}

function toBody(f: Form) {
  return {
    name: f.name,
    description: f.description,
    vendor: f.vendor,
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    seoTitle: f.seoTitle,
    seoDescription: f.seoDescription,
    status: f.status,
    categorySlug: f.categorySlug || null,
    collectionIds: f.collectionIds,
    images: f.images.filter((i) => i.url.trim()).map((i) => ({ url: i.url.trim(), alt: i.alt })),
    options: f.options.filter((o) => o.name.trim() && o.values.length > 0),
    variants: f.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: v.price.trim(),
      compareAtPrice: v.compareAtPrice.trim() || null,
      stock: Number(v.stock),
      optionValues: v.optionValues,
    })),
  }
}

// One variant per combination of option values. Rows whose combination survives keep their
// id/price/stock; new combinations start from the first row's price.
function rebuildVariants(options: Option[], old: Row[]): Row[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0)
  if (usable.length === 0) return [old[0] ?? blankRow()].map((r) => ({ ...r, optionValues: {} }))
  let combos: Array<Record<string, string>> = [{}]
  for (const option of usable) {
    combos = combos.flatMap((c) => option.values.map((value) => ({ ...c, [option.name]: value })))
  }
  const key = (c: Record<string, string>) => JSON.stringify(usable.map((o) => c[o.name]))
  const byKey = new Map(old.map((r) => [key(r.optionValues), r]))
  return combos.map((combo) => {
    const found = byKey.get(key(combo))
    return found
      ? { ...found, optionValues: combo }
      : { ...blankRow(), price: old[0]?.price ?? '', optionValues: combo }
  })
}

export function ProductEditorPage({ store, token, notify, param }: PageProps) {
  const isNew = !param || param === 'new'
  const base = `/stores/${store.slug}`
  const [form, setForm] = useState<Form>(emptyForm)
  const [valueDraft, setValueDraft] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [newCollection, setNewCollection] = useState('')

  const productQuery = useQuery<Product | null>(
    ['product', store.slug, param],
    () => apiRequest(`${base}/products/${param}`, { token }),
    { enabled: !isNew, initialData: null },
  )
  const categoriesQuery = useQuery<ProductCategory[]>(['categories'], () => apiRequest('/catalog/categories'), {
    initialData: [],
  })
  const collectionsQuery = useQuery<Collection[]>(
    ['collections', store.slug],
    () => apiRequest(`${base}/collections`),
    { initialData: [] },
  )

  useEffect(() => {
    if (productQuery.data) setForm(toForm(productQuery.data))
  }, [productQuery.data])

  const saveMutation = useMutation<Form, Product>(
    (input) =>
      apiRequest(isNew ? `${base}/products` : `${base}/products/${param}`, {
        method: isNew ? 'POST' : 'PATCH',
        token,
        body: JSON.stringify(toBody(input)),
      }),
    {
      onSuccess: (product) => {
        notify('Product saved')
        if (isNew) location.hash = `#/products/${product.id}`
        else productQuery.setData(product)
      },
      onError: notify,
    },
  )
  const deleteMutation = useMutation<void, unknown>(
    () => apiRequest(`${base}/products/${param}`, { method: 'DELETE', token }),
    {
      onSuccess: () => {
        notify('Product deleted')
        location.hash = '#/products'
      },
      onError: notify,
    },
  )
  const collectionMutation = useMutation<string, Collection>(
    (name) => apiRequest(`${base}/collections`, { method: 'POST', token, body: JSON.stringify({ name }) }),
    {
      onSuccess: async (c) => {
        setNewCollection('')
        setForm((f) => ({ ...f, collectionIds: [...f.collectionIds, c.id] }))
        await collectionsQuery.refetch()
      },
      onError: notify,
    },
  )

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setOptions = (options: Option[]) =>
    setForm((f) => ({ ...f, options, variants: rebuildVariants(options, f.variants) }))
  const setRow = (index: number, patch: Partial<Row>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((r, i) => (i === index ? { ...r, ...patch } : r)) }))

  function addValue(index: number) {
    const value = (valueDraft[index] ?? '').trim()
    if (!value || form.options[index].values.includes(value)) return
    setOptions(form.options.map((o, i) => (i === index ? { ...o, values: [...o.values, value] } : o)))
    setValueDraft((d) => d.map((v, i) => (i === index ? '' : v)))
  }
  function onValueKey(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addValue(index)
    }
  }
  function moveImage(index: number, delta: number) {
    const images = [...form.images]
    const [item] = images.splice(index, 1)
    images.splice(index + delta, 0, item)
    set('images', images)
  }

  const single = form.options.length === 0
  const busy = saveMutation.isPending || deleteMutation.isPending
  const title = form.name || (isNew ? 'Add product' : 'Product')
  const preview = (form.seoTitle || form.name || 'Page title').slice(0, 70)

  if (!isNew && productQuery.error) {
    return <div className="notice">{productQuery.error}</div>
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <a href="#/products">← Products</a>
          <h2>{title}</h2>
          <span className={form.status === 'ACTIVE' ? 'badge success' : 'badge'}>
            {form.status === 'ACTIVE' ? 'Active' : 'Draft'}
          </span>
        </div>
        <div className="actions">
          {!isNew ? (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => confirm('Delete this product?') && deleteMutation.mutate().catch(() => undefined)}
            >
              Delete
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => saveMutation.mutate(form).catch(() => undefined)}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          <div className="panel form-grid">
            <label>
              Title
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Short sleeve t-shirt" />
            </label>
            <label>
              Description
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
            </label>
          </div>

          <div className="panel form-grid">
            <h3 className="card-title">Media</h3>
            {form.images.length > 0 ? (
              <div className="media-list">
                {form.images.map((image, index) => (
                  <div className="media-row" key={index}>
                    <img className="thumb lg" src={image.url} alt={image.alt} />
                    <div className="form-grid">
                      <input
                        value={image.url}
                        aria-label="Image URL"
                        onChange={(e) =>
                          set('images', form.images.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))
                        }
                      />
                      <input
                        value={image.alt}
                        placeholder="Alt text"
                        aria-label="Alt text"
                        onChange={(e) =>
                          set('images', form.images.map((x, i) => (i === index ? { ...x, alt: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="row-actions">
                      <button type="button" className="secondary" disabled={index === 0} onClick={() => moveImage(index, -1)}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={index === form.images.length - 1}
                        onClick={() => moveImage(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => set('images', form.images.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="inline-form">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://… image URL"
                aria-label="New image URL"
              />
              <button
                type="button"
                className="secondary"
                disabled={!imageUrl.trim()}
                onClick={() => {
                  set('images', [...form.images, { url: imageUrl.trim(), alt: '' }])
                  setImageUrl('')
                }}
              >
                Add image
              </button>
            </div>
            <span className="muted">The first image is the cover.</span>
          </div>

          {single ? (
            <div className="panel form-grid">
              <h3 className="card-title">Pricing &amp; inventory</h3>
              <div className="two-col">
                <label>
                  Price ({store.currency})
                  <input inputMode="decimal" value={form.variants[0].price} onChange={(e) => setRow(0, { price: e.target.value })} />
                </label>
                <label>
                  Compare-at price
                  <input
                    inputMode="decimal"
                    value={form.variants[0].compareAtPrice}
                    onChange={(e) => setRow(0, { compareAtPrice: e.target.value })}
                  />
                </label>
                <label>
                  SKU
                  <input value={form.variants[0].sku} onChange={(e) => setRow(0, { sku: e.target.value })} />
                </label>
                <label>
                  Quantity
                  <input inputMode="numeric" value={form.variants[0].stock} onChange={(e) => setRow(0, { stock: e.target.value })} />
                </label>
              </div>
            </div>
          ) : null}

          <div className="panel form-grid">
            <h3 className="card-title">Variants</h3>
            {form.options.map((option, index) => (
              <div className="option-card" key={index}>
                <div className="inline-form">
                  <input
                    value={option.name}
                    placeholder="Option name (Size, Color…)"
                    aria-label="Option name"
                    onChange={(e) => setOptions(form.options.map((o, i) => (i === index ? { ...o, name: e.target.value } : o)))}
                  />
                  <button type="button" className="danger" onClick={() => setOptions(form.options.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </div>
                <div className="chips">
                  {option.values.map((value) => (
                    <span className="chip" key={value}>
                      {value}
                      <button
                        type="button"
                        aria-label={`Remove ${value}`}
                        onClick={() =>
                          setOptions(
                            form.options.map((o, i) =>
                              i === index ? { ...o, values: o.values.filter((v) => v !== value) } : o,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="chip-input"
                    value={valueDraft[index] ?? ''}
                    placeholder="Add value, press Enter"
                    aria-label="Option value"
                    onChange={(e) => setValueDraft((d) => Object.assign([...d], { [index]: e.target.value }))}
                    onKeyDown={(e) => onValueKey(e, index)}
                    onBlur={() => addValue(index)}
                  />
                </div>
              </div>
            ))}
            {form.options.length < 3 ? (
              <button
                type="button"
                className="secondary fit"
                onClick={() => {
                  // the single "Default" row has no option values; the first real option rebuilds it
                  setOptions([...form.options, { name: '', values: [] }])
                }}
              >
                + Add option
              </button>
            ) : null}
            {!single ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Price</th>
                    <th>Compare-at</th>
                    <th>Quantity</th>
                    <th>SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((row, index) => (
                    <tr key={Object.values(row.optionValues).join('/') || index}>
                      <td>{Object.values(row.optionValues).join(' / ') || 'Default'}</td>
                      <td>
                        <input inputMode="decimal" value={row.price} aria-label="Variant price" onChange={(e) => setRow(index, { price: e.target.value })} />
                      </td>
                      <td>
                        <input
                          inputMode="decimal"
                          value={row.compareAtPrice}
                          aria-label="Variant compare-at price"
                          onChange={(e) => setRow(index, { compareAtPrice: e.target.value })}
                        />
                      </td>
                      <td>
                        <input inputMode="numeric" value={row.stock} aria-label="Variant quantity" onChange={(e) => setRow(index, { stock: e.target.value })} />
                      </td>
                      <td>
                        <input value={row.sku} aria-label="Variant SKU" onChange={(e) => setRow(index, { sku: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="muted">Add options like size or color to create variants with their own price and stock.</span>
            )}
          </div>

          <div className="panel form-grid">
            <h3 className="card-title">Search engine listing</h3>
            <div className="seo-preview">
              <span className="seo-url">
                {(store.domains.find((d) => d.isPrimary)?.hostname ?? store.slug)} › products
              </span>
              <strong>{preview}</strong>
              <span>{(form.seoDescription || form.description || 'Description').slice(0, 160)}</span>
            </div>
            <label>
              Page title
              <input value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
            </label>
            <label>
              Meta description
              <textarea value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
            </label>
          </div>
        </div>

        <aside className="editor-side">
          <div className="panel form-grid">
            <label>
              Status
              <select value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
          </div>
          <div className="panel form-grid">
            <h3 className="card-title">Product organization</h3>
            <label>
              Category
              <select value={form.categorySlug} onChange={(e) => set('categorySlug', e.target.value)}>
                <option value="">Uncategorized</option>
                {categoriesQuery.data.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendor
              <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} />
            </label>
            <label>
              Tags
              <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="summer, cotton" />
            </label>
          </div>
          <div className="panel form-grid">
            <h3 className="card-title">Collections</h3>
            <div className="check-list">
              {collectionsQuery.data.map((c) => (
                <label className="check-row" key={c.id}>
                  <input
                    type="checkbox"
                    checked={form.collectionIds.includes(c.id)}
                    onChange={(e) =>
                      set('collectionIds', e.target.checked ? [...form.collectionIds, c.id] : form.collectionIds.filter((id) => id !== c.id))
                    }
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {collectionsQuery.data.length === 0 ? <span className="muted">No collections yet.</span> : null}
            </div>
            <div className="inline-form">
              <input value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="New collection" aria-label="New collection" />
              <button
                type="button"
                className="secondary"
                disabled={collectionMutation.isPending || !newCollection.trim()}
                onClick={() => collectionMutation.mutate(newCollection).catch(() => undefined)}
              >
                Add
              </button>
            </div>
          </div>
          {form.variants[0]?.price ? (
            <div className="panel muted">
              From {formatMoney(Math.min(...form.variants.map((v) => Number(v.price) || 0)), store.currency)}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
