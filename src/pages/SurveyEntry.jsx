import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { getStand, getStandCatalog, createSurvey } from '../lib/db'

export default function SurveyEntry() {
  const { standId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useSession()
  const { runnerId } = session

  const [stand, setStand] = useState(
    location.state?.standName ? { name: location.state.standName } : null
  )
  const [items, setItems] = useState([])
  const [qtys, setQtys] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!runnerId) {
      navigate('/runner', { replace: true })
      return
    }

    const fetches = [
      getStandCatalog(standId),
      stand ? Promise.resolve(stand) : getStand(standId),
    ]

    Promise.all(fetches)
      .then(([catalog, foundStand]) => {
        const sorted = [...catalog].sort(
          (a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)
        )
        setStand(foundStand)
        setItems(sorted)
        const init = {}
        sorted.forEach(i => { init[i.id] = 0 })
        setQtys(init)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [standId]) // eslint-disable-line react-hooks/exhaustive-deps

  function setQty(itemId, value) {
    setQtys(prev => ({ ...prev, [itemId]: Math.max(0, value) }))
  }

  const totalItems = Object.values(qtys).filter(q => q > 0).length

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    try {
      const surveyItems = items.map(i => ({ item_id: i.id, qty_needed: qtys[i.id] ?? 0 }))
      await createSurvey(standId, runnerId, surveyItems)
      navigate('/runner/picklist')
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  // Group items by category
  const byCategory = {}
  for (const item of items) {
    const cat = item.category ?? 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="text-emerald-200 py-2.5 px-2 -my-1.5 text-sm">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">
            {stand ? stand.name : 'Survey'}
          </div>
          <div className="text-emerald-200 text-xs">Pre-game survey</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 pb-28">
        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {loading && (
          <div className="p-8 text-center text-slate-400">Loading catalog…</div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <p className="mb-3">This stand has no catalog items yet.</p>
            <p className="text-sm">Set up the catalog in Manager → Catalog.</p>
          </div>
        )}

        {!loading && Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
          <div key={cat}>
            <div className="px-4 py-1.5 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {cat}
            </div>
            {catItems.map(item => {
              const qty = qtys[item.id] ?? 0
              return (
                <div
                  key={item.id}
                  className={`flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-white transition-opacity ${qty === 0 ? 'opacity-40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.unit}</div>
                  </div>
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
                      className="w-10 h-10 rounded-full bg-emerald-600 text-white text-2xl font-bold flex items-center justify-center active:bg-emerald-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {!loading && items.length > 0 && (
          <p className="px-4 pt-3 pb-1 text-xs text-slate-400 text-center">
            Leave items at 0 if the stand is fully stocked.
          </p>
        )}
      </div>

      {/* Fixed bottom bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 pt-3 pb-safe flex gap-3 z-20">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 px-5 py-3.5 border border-slate-300 text-slate-600 rounded-xl font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || items.length === 0}
            className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base disabled:opacity-50 active:bg-emerald-700"
          >
            {submitting
              ? 'Saving…'
              : totalItems > 0
                ? `Save Survey (${totalItems} item${totalItems !== 1 ? 's' : ''})`
                : 'Save Survey (stand is stocked)'}
          </button>
        </div>
      )}
    </div>
  )
}
