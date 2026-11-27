import { useState } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import { formatDate } from '../lib/format'
import type { PageProps, PageSummary, TemplateSummary } from '../lib/types'
import { starterHome } from '../builder/sections'

export function PagesPage({ store, token, notify }: PageProps) {
  const base = `/stores/${store.slug}/pages`
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState('')
  const templates = useQuery<TemplateSummary[]>(['templates'], () => apiRequest('/templates', { token }), { initialData: [] })
  const query = useQuery<PageSummary[]>(['pages', store.slug], () => apiRequest(base, { token }), { initialData: [] })

  const createMutation = useMutation<{ title: string; slug?: string; data?: unknown; templateId?: string }, PageSummary>(
    (input) => apiRequest(base, { method: 'POST', token, body: JSON.stringify(input) }),
    { onSuccess: (page) => void (location.hash = `#/pages/${page.id}`), onError: notify },
  )
  const deleteMutation = useMutation<string, unknown>((id) => apiRequest(`${base}/${id}`, { method: 'DELETE', token }), {
    onSuccess: async () => {
      notify('Page deleted')
      await query.refetch()
    },
    onError: notify,
  })

  const hasHome = query.data.some((p) => p.slug === 'home')

  return (
    <section className="page">
      <div className="page-header">
        <h2>Pages</h2>
        {!hasHome && !query.isLoading ? (
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate({ title: 'Home', slug: 'home', data: starterHome() }).catch(() => undefined)}
          >
            Customize home page
          </button>
        ) : null}
      </div>
      <form
        className="panel inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate({ title, templateId: templateId || undefined }).catch(() => undefined)
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New page title, e.g. About us" aria-label="New page title" />
        {templates.data.length ? (
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label="Start from template">
            <option value="">Blank page</option>
            {templates.data.map((t) => (
              <option key={t.id} value={t.id}>
                Template: {t.name}
                {t.category ? ` (${t.category})` : ''}
              </option>
            ))}
          </select>
        ) : null}
        <button type="submit" disabled={!title.trim() || createMutation.isPending}>
          Add page
        </button>
      </form>
      <div className="panel flush">
        {query.error ? <div className="notice">{query.error}</div> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>URL</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={`#/pages/${p.id}`}>
                    <strong>{p.title}</strong>
                  </a>
                </td>
                <td className="muted">{p.slug === 'home' ? '/' : `#/pages/${p.slug}`}</td>
                <td>
                  {p.publishedVersion ? (
                    <span className="badge success">Published v{p.publishedVersion.version}</span>
                  ) : (
                    <span className="badge">Draft</span>
                  )}
                </td>
                <td className="muted">{formatDate(p.updatedAt)}</td>
                <td className="row-actions">
                  <a className="btn" href={`#/pages/${p.id}`}>
                    Edit
                  </a>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => confirm(`Delete "${p.title}"?`) && deleteMutation.mutate(p.id).catch(() => undefined)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data.length === 0 && !query.isLoading ? (
          <div className="empty">No pages yet. Customize your home page or add a page like "About us".</div>
        ) : null}
      </div>
    </section>
  )
}
