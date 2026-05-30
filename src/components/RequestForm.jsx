import { useState, useEffect } from 'react'
import { getStandCatalog, createRequest } from '../lib/db'

export default function RequestForm({ standId, standName, createdBy, onSuccess, onCancel }) {
  const [items, setItems] = useState([])
  const [qtys, setQtys] = useState({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStandCatalog(standId)
      .then(catalog => {
        const sorted = [...catalog].sort((a, b) =>
          (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)
        )
        setItems(sorted)
        const init = {}
        sorted.forEach(i => { init[i.id] = 0 })
        setQtys(init)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [standId])

  function setQty(itemId, value) {
    setQtys(prev => ({ ...prev, [itemId]: Math.max(0, value) }))
  }

  const selectedItems = items.filter(i => (qtys[i.id] ?? 0) > 0)

  async function handleSubmit() {
    if (selectedItems.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = selectedItems.map(i => ({ item_id: i.id, qty: qtys[i.id] }))
      const request = await createRequest(standId, createdBy, payload, note.trim())
      onSuccess(request)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading catalog…</div>
  }

  if (error && items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button onClick={onCancel} className="text-blue-600 underline">Go back</button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500 text-sm mb-2 font-medium">{standName}</p>
        <p className="text-slate-400 text-sm mb-4">
          This stand has no catalog items yet. Set it up in Manager → Catalog.
        </p>
        <button onClick={onCancel} className="text-blue-600 underline">Go back</button>
      </div>
    )
  }

  // Group by category
  const byCategory = {}
  for (const item of items) {
    const cat = item.category ?? 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  return (
    <div className="pb-28">
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
        <div key={cat}>
          <div className="px-4 py-1.5 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {cat}
          </div>
          {catItems.map(item => {
            const qty = qtys[item.id] ?? 0
            return (
              <div
                key={item.id}
                className={`flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 transition-opacity ${qty === 0 ? 'opacity-40' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-400">{item.unit}</div>
                </div>
                {/* Stepper */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setQty(item.id, qty - 1)}
                    disabled={qty === 0}
                    className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 text-2xl font-bold flex items-center justify-center disabled:opacity-25 active:bg-slate-300"
                  >
                    −
                  </button>
                  <span className={`w-8 text-center font-bold text-xl tabular-nums ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(item.id, qty + 1)}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center active:bg-blue-700"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <div className="px-4 py-4">
        <textarea
          placeholder="Note for the runner (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 pt-3 pb-safe flex gap-3 z-20">
        <button
          onClick={onCancel}
          className="shrink-0 px-5 py-3.5 border border-slate-300 text-slate-600 rounded-xl font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={selectedItems.length === 0 || submitting}
          className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-base disabled:opacity-50 active:bg-blue-700"
        >
          {submitting
            ? 'Sending…'
            : `Request${selectedItems.length > 0 ? ` (${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''})` : ''}`}
        </button>
      </div>
    </div>
  )
}
