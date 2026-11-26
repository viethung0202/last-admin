import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Puck } from '@puckeditor/core'
import type { Config, Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import type { Collection, PageDetail, PageProps, Product } from '../lib/types'
import { createSections } from '../builder/sections'

const VIEWPORTS = [
  { width: 390, height: 'auto' as const, label: 'Mobile', icon: 'Smartphone' as const },
  { width: 768, height: 'auto' as const, label: 'Tablet', icon: 'Tablet' as const },
  { width: 1280, height: 'auto' as const, label: 'Desktop', icon: 'Monitor' as const },
]

// Full-screen theme editor (Shopify "Customize"): drag sections, edit props, preview
// per viewport, save the draft, publish an immutable version, restore an old one.
export function PageEditorPage({ store, token, notify, param }: PageProps) {
  const base = `/stores/${store.slug}/pages/${param}`
  const [dirty, setDirty] = useState(false)
  // bumps when the draft is replaced from outside Puck (load/restore) so Puck remounts with it
  const [rev, setRev] = useState(0)

  const pageQuery = useQuery<PageDetail | null>(['page', param], () => apiRequest(base, { token }), { initialData: null })
  const productsQuery = useQuery<Product[]>(['products', store.slug], () => apiRequest(`/stores/${store.slug}/products`, { token }), {
    initialData: [],
  })
  const collectionsQuery = useQuery<Collection[]>(['collections', store.slug], () => apiRequest(`/stores/${store.slug}/collections`), {
    initialData: [],
  })

  const config = useMemo<Config>(() => {
    const sections = createSections({
      products: productsQuery.data.filter((p) => p.status === 'ACTIVE' && p.variants.length > 0),
      collections: collectionsQuery.data,
      money: (amount) => formatMoney(amount, store.currency),
    })
    return {
      components: Object.fromEntries(
        Object.entries(sections).map(([type, s]) => [type, { label: s.label, fields: s.fields, defaultProps: s.defaultProps, render: s.render }]),
      ),
      root: { fields: {}, render: ({ children }: { children: ReactNode }) => <div className="sf-root">{children}</div> },
    } as Config
  }, [productsQuery.data, collectionsQuery.data, store.currency])

  const onPage = (page: PageDetail, message: string) => {
    pageQuery.setData(page)
    setDirty(false)
    notify(message)
  }
  const saveMutation = useMutation<Data, PageDetail>(
    (data) => apiRequest(`${base}/draft`, { method: 'PUT', token, body: JSON.stringify({ data }) }),
    { onSuccess: (page) => onPage(page, 'Draft saved'), onError: notify },
  )
  // publish = save the current editor state, then snapshot it
  const publishMutation = useMutation<Data, PageDetail>(
    async (data) => {
      await apiRequest(`${base}/draft`, { method: 'PUT', token, body: JSON.stringify({ data }) })
      return apiRequest(`${base}/publish`, { method: 'POST', token })
    },
    { onSuccess: (page) => onPage(page, `Published version ${page.publishedVersion?.version}`), onError: notify },
  )
  const restoreMutation = useMutation<string, PageDetail>(
    (versionId) => apiRequest(`${base}/versions/${versionId}/restore`, { method: 'POST', token }),
    {
      onSuccess: (page) => {
        onPage(page, 'Version restored into the draft. Publish to make it live.')
        setRev((r) => r + 1)
      },
      onError: notify,
    },
  )

  const page = pageQuery.data
  if (pageQuery.error) return <div className="notice">{pageQuery.error}</div>
  if (!page) return <div className="empty">Loading editor...</div>

  const busy = saveMutation.isPending || publishMutation.isPending || restoreMutation.isPending

  return (
    <div className="builder-screen">
      <Puck
        key={`${page.id}-${rev}`}
        config={config}
        data={page.draft as Data}
        headerTitle={page.title}
        headerPath={page.slug === 'home' ? '/' : `/pages/${page.slug}`}
        viewports={VIEWPORTS}
        height="100%"
        onChange={() => setDirty(true)}
        renderHeaderActions={({ state }) => (
          <div className="builder-actions">
            <a className="builder-exit" href="#/pages">
              ← Exit
            </a>
            <span className={page.publishedVersion ? 'badge success' : 'badge'}>
              {page.publishedVersion ? `Live v${page.publishedVersion.version}` : 'Not published'}
            </span>
            {dirty ? <span className="badge">Unsaved changes</span> : null}
            <select
              aria-label="Version history"
              value=""
              disabled={busy || page.versions.length === 0}
              onChange={(e) => {
                const v = page.versions.find((x) => x.id === e.target.value)
                if (v && (!dirty || confirm('Discard unsaved changes and restore this version?'))) {
                  restoreMutation.mutate(v.id).catch(() => undefined)
                }
              }}
            >
              <option value="">History ({page.versions.length})</option>
              {page.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {formatDate(v.createdAt)}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={busy} onClick={() => saveMutation.mutate(state.data).catch(() => undefined)}>
              Save draft
            </button>
            <button type="button" disabled={busy} onClick={() => publishMutation.mutate(state.data).catch(() => undefined)}>
              Publish
            </button>
          </div>
        )}
      />
    </div>
  )
}
