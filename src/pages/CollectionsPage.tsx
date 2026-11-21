import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, useMutation, useQuery } from '../lib/api'
import type { Collection, PageProps } from '../lib/types'

export function CollectionsPage({ store, token, notify }: PageProps) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const base = `/stores/${store.slug}/collections`

  const collectionsQuery = useQuery<Collection[]>(
    ['collections', store.slug],
    () => apiRequest(base),
    { initialData: [] },
  )

  const saveMutation = useMutation<{ id?: string; name: string }, Collection>(
    (input) =>
      apiRequest(input.id ? `${base}/${input.id}` : base, {
        method: input.id ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify({ name: input.name }),
      }),
    {
      onSuccess: async (collection, input) => {
        notify(input.id ? `Renamed to ${collection.name}` : `Collection ${collection.name} created`)
        setName('')
        setEditing(null)
        await collectionsQuery.refetch()
      },
      onError: notify,
    },
  )

  const deleteMutation = useMutation<string, { deleted: boolean }>(
    (id) => apiRequest(`${base}/${id}`, { method: 'DELETE', token }),
    {
      onSuccess: async () => {
        notify('Collection deleted')
        await collectionsQuery.refetch()
      },
      onError: notify,
    },
  )

  function create(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate({ name }).catch(() => undefined)
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Collections</p>
          <h2>{collectionsQuery.data.length} collections</h2>
        </div>
      </div>
      <form onSubmit={create} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" />
        <button type="submit" disabled={saveMutation.isPending || !name.trim()}>
          Add
        </button>
      </form>
      <div className="table">
        {collectionsQuery.data.map((collection) => (
          <article className="product-row" key={collection.id}>
            <div>
              {editing?.id === collection.id ? (
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              ) : (
                <strong>{collection.name}</strong>
              )}
              <small>/{collection.slug}</small>
            </div>
            <span>{collection._count?.products ?? 0} products</span>
            <div className="row-actions">
              {editing?.id === collection.id ? (
                <>
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(editing).catch(() => undefined)}
                  >
                    Save
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: collection.id, name: collection.name })}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (confirm(`Delete ${collection.name}? Products are kept.`)) {
                        deleteMutation.mutate(collection.id).catch(() => undefined)
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {collectionsQuery.data.length === 0 ? (
          <div className="empty">No collections yet. Group products for the storefront here.</div>
        ) : null}
      </div>
    </section>
  )
}
