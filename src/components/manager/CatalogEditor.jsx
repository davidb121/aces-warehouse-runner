import { useState, useEffect } from 'react'
import { getStands, getAllItems, getStandCatalogIds, toggleStandCatalogItem } from '../../lib/db'
import { useToast } from '../../hooks/useToast'
import Toast from '../Toast'

export default function CatalogEditor() {
  const [stands, setStands] = useState([])
  const [selectedStand, setSelectedStand] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [catalogIds, setCatalogIds] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [toggling, setToggling] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { toast, showToast } = useToast()

  useEffect(() => {
    getStands()
      .then(setStands)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function selectStand(stand) {
    setError(null)
    setFilter('')
    setSelectedStand(stand)
    try {
      const [items, ids] = await Promise.all([
        getAllItems(),
        getStandCatalogIds(stand.id)
      ])
      setAllItems(items.filter(i => i.is_active))
      setCatalogIds(new Set(ids))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleToggle(itemId, checked) {
    // Optimistic update
    setCatalogIds(prev => {
      const next = new Set(prev)
      checked ? next.add(itemId) : next.delete(itemId)
      return next
    })
    setToggling(prev => new Set(prev).add(itemId))
    try {
      await toggleStandCatalogItem(selectedStand.id, itemId, checked)
    } catch (e) {
      // Revert on failure
      setCatalogIds(prev => {
        const next = new Set(prev)
        checked ? next.delete(itemId) : next.add(itemId)
        return next
      })
      showToast('Save failed — try again')
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  if (loading) return <div className="p-6 text-slate-500 text-center">Loading…</div>
  if (error && !selectedStand) return <div className="px-4 py-3 bg-red-50 text-red-600 text-sm">{error}</div>

  // Stand picker
  if (!selectedStand) {
    return (
      <div className="pb-10">
        <Toast message={toast} />
        <div className="px-4 py-3 border-b border-slate-100 bg-white sticky top-0">
          <p className="text-sm text-slate-500">Pick a stand to edit its item catalog</p>
        </div>
        <div className="divide-y divide-slate-100">
          {stands.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-400">
              No stands yet. Add stands in the Stands tab first.
            </div>
          )}
          {stands.map(stand => (
            <button
              key={stand.id}
              onClick={() => selectStand(stand)}
              className="w-full flex items-center px-4 py-4 gap-3 text-left active:bg-slate-50"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">
                  {stand.number ? `#${stand.number} · ` : ''}{stand.name}
                </div>
                {stand.location_note && (
                  <div className="text-xs text-slate-400 mt-0.5">{stand.location_note}</div>
                )}
              </div>
              <span className="text-slate-300 text-xl">›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Catalog checklist
  const filtered = allItems.filter(item =>
    !filter || item.name.toLowerCase().includes(filter.toLowerCase()) ||
    (item.category ?? '').toLowerCase().includes(filter.toLowerCase())
  )
  const selectedCount = catalogIds.size

  // Group by category for readability
  const byCategory = {}
  for (const item of filtered) {
    const cat = item.category ?? 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  return (
    <div className="pb-24">
      <Toast message={toast} />

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setSelectedStand(null)}
            className="text-blue-600 text-sm font-medium shrink-0"
          >
            ← Stands
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 truncate">{selectedStand.name}</div>
            <div className="text-xs text-slate-400">{selectedCount} of {allItems.length} items selected</div>
          </div>
        </div>
        <input
          type="search"
          placeholder="Filter items…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>}

      {filtered.length === 0 && (
        <div className="px-4 py-10 text-center text-slate-400">
          {allItems.length === 0
            ? 'No items yet. Add items in the Items tab first.'
            : 'No items match your filter.'}
        </div>
      )}

      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
        <div key={cat}>
          <div className="px-4 py-1.5 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {cat}
          </div>
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const checked = catalogIds.has(item.id)
              const isSaving = toggling.has(item.id)
              return (
                <label
                  key={item.id}
                  className="flex items-center px-4 py-3.5 gap-4 active:bg-slate-50 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isSaving}
                    onChange={e => handleToggle(item.id, e.target.checked)}
                    className="w-5 h-5 rounded accent-blue-600 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.unit}</div>
                  </div>
                  {isSaving && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />}
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
