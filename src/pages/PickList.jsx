import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useToast } from '../hooks/useToast'
import { getSurveysForRunner, updateSurveyStatus, closePickList } from '../lib/db'
import Toast from '../components/Toast'

export default function PickList() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { runnerId, runnerName } = session
  const { toast, showToast } = useToast()

  // 'open' + 'picked' = active pick list; 'done' = historical
  const [openSurveys, setOpenSurveys] = useState([])
  const [doneSurveys, setDoneSurveys] = useState([])
  const [checked, setChecked] = useState({})        // { [surveyId]: Set<itemId> }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('flat')
  const [marking, setMarking] = useState(new Set()) // surveyIds being marked as picked
  const [closing, setClosing] = useState(false)
  const [expandedRecent, setExpandedRecent] = useState(new Set())
  // Flat-view item checkboxes — local only, no DB writes
  const [flatChecked, setFlatChecked] = useState(new Set())

  const load = useCallback(async () => {
    if (!runnerId) return
    try {
      const all = await getSurveysForRunner(runnerId)
      const open = all.filter(s => s.status === 'open' || s.status === 'picked')
      const done = all.filter(s => s.status === 'done')
      setOpenSurveys(open)
      setDoneSurveys(done)
      setChecked(prev => {
        const next = { ...prev }
        open.forEach(s => {
          if (!next[s.id]) {
            // Pre-populate 'picked' surveys so a hard-refresh restores checkmarks
            if (s.status === 'picked') {
              const needed = (s.survey_items ?? []).filter(si => si.qty_needed > 0)
              next[s.id] = new Set(needed.map(si => si.item_id))
            } else {
              next[s.id] = new Set()
            }
          }
        })
        return next
      })
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [runnerId])

  useEffect(() => {
    if (!runnerId) { navigate('/runner', { replace: true }); return }
    load().finally(() => setLoading(false))
  }, [runnerId, load, navigate])

  async function markPicked(surveyId) {
    setMarking(prev => new Set(prev).add(surveyId))
    try {
      await updateSurveyStatus(surveyId, 'picked')
      showToast('Stand loaded ✓')
      await load()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setMarking(prev => { const n = new Set(prev); n.delete(surveyId); return n })
    }
  }

  async function handleClose() {
    const ids = openSurveys.map(s => s.id)
    if (!ids.length) return
    setClosing(true)
    try {
      await closePickList(ids)
      showToast('Pick list closed!')
      await load()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setClosing(false)
    }
  }

  function handleCheck(surveyId, itemId, value) {
    setChecked(prev => {
      const set = new Set(prev[surveyId] ?? [])
      value ? set.add(itemId) : set.delete(itemId)
      const next = { ...prev, [surveyId]: set }

      const survey = openSurveys.find(s => s.id === surveyId)
      const needed = (survey?.survey_items ?? []).filter(si => si.qty_needed > 0)
      if (needed.length > 0 && set.size >= needed.length) {
        markPicked(surveyId)
      }

      return next
    })
  }

  function handleMarkAll(surveyId) {
    const survey = openSurveys.find(s => s.id === surveyId)
    const needed = (survey?.survey_items ?? []).filter(si => si.qty_needed > 0)
    setChecked(prev => ({ ...prev, [surveyId]: new Set(needed.map(si => si.item_id)) }))
    markPicked(surveyId)
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const activeSurveys  = openSurveys.filter(s => s.status === 'open')
  const pickedSurveys  = openSurveys.filter(s => s.status === 'picked')

  const surveysWithItems  = activeSurveys.filter(s => (s.survey_items ?? []).some(si => si.qty_needed > 0))
  const stockedSurveys    = activeSurveys.filter(s => !(s.survey_items ?? []).some(si => si.qty_needed > 0))

  // Collated items: one entry per item type, with a sub-list of stands
  const itemMap = new Map()
  for (const survey of openSurveys) {
    for (const si of (survey.survey_items ?? []).filter(si => si.qty_needed > 0)) {
      if (!itemMap.has(si.item_id)) {
        itemMap.set(si.item_id, {
          id: si.item_id,
          name: si.items?.name ?? si.item_id,
          category: si.items?.category ?? '',
          unit: si.items?.unit ?? '',
          totalQty: 0,
          stands: [],
        })
      }
      const entry = itemMap.get(si.item_id)
      entry.totalQty += si.qty_needed
      entry.stands.push({
        surveyId: survey.id,
        standName: survey.stands?.name ?? '?',
        standNumber: survey.stands?.number ?? null,
        qty: si.qty_needed,
        itemId: si.item_id,
      })
    }
  }
  const collatedItems = Array.from(itemMap.values()).sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  )

  // Progress: total stand-item deliveries checked vs needed
  const totalNeeded  = collatedItems.reduce((sum, item) => sum + item.stands.length, 0)
  const totalChecked = Object.values(checked).reduce((sum, set) => sum + set.size, 0)

  // Recent pick lists: done surveys grouped by date
  const recentByDate = {}
  for (const survey of doneSurveys) {
    const label = new Date(survey.created_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    if (!recentByDate[label]) recentByDate[label] = []
    recentByDate[label].push(survey)
  }
  const recentDates = Object.keys(recentByDate)

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <PickListHeader runnerName={runnerName} navigate={navigate} />
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading…</div>
      </div>
    )
  }

  // ── Empty (no active list, no history) ───────────────────────────────────

  if (openSurveys.length === 0 && recentDates.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <PickListHeader runnerName={runnerName} navigate={navigate} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <div className="text-4xl">📋</div>
          <h2 className="text-xl font-bold text-slate-700">No Open Surveys</h2>
          <p className="text-slate-400 text-sm">Survey stands first to build your cart list.</p>
          <button
            onClick={() => navigate('/runner')}
            className="mt-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold"
          >
            Go Survey Stands
          </button>
        </div>
      </div>
    )
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <Toast message={toast} />
      <PickListHeader runnerName={runnerName} navigate={navigate} />

      {/* Progress bar + view toggle (only when active list exists) */}
      {openSurveys.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-slate-600">
            {viewMode === 'flat'
              ? `${flatChecked.size} / ${collatedItems.length} items on cart`
              : `${totalChecked} / ${totalNeeded} loaded`}
          </span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 ${viewMode === 'grouped' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
            >
              By Stand
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`px-3 py-1.5 ${viewMode === 'flat' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
            >
              All Items
            </button>
          </div>
        </div>
      )}

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm shrink-0">{error}</div>}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 pb-4">

        {/* ── BY STAND VIEW ──────────────────────────────────────────── */}
        {viewMode === 'grouped' && openSurveys.length > 0 && (
          <>
            {surveysWithItems.map(survey => {
              const needed       = (survey.survey_items ?? []).filter(si => si.qty_needed > 0)
              const standLabel   = standName(survey)
              const surveyChecked = checked[survey.id] ?? new Set()
              const allDone      = surveyChecked.size >= needed.length
              const isMarking    = marking.has(survey.id)

              return (
                <div key={survey.id} className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">{standLabel}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {surveyChecked.size} / {needed.length} items loaded
                      </div>
                    </div>
                    <button
                      onClick={() => handleMarkAll(survey.id)}
                      disabled={isMarking || allDone}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 disabled:opacity-40 active:bg-emerald-200"
                    >
                      {isMarking ? '…' : 'Mark All'}
                    </button>
                  </div>

                  {needed
                    .sort((a, b) =>
                      (a.items?.category ?? '').localeCompare(b.items?.category ?? '') ||
                      (a.items?.name ?? '').localeCompare(b.items?.name ?? '')
                    )
                    .map(si => {
                      const isChecked = (checked[survey.id] ?? new Set()).has(si.item_id)
                      return (
                        <label
                          key={si.id}
                          className={`flex items-center px-4 py-3.5 border-b border-slate-100 last:border-0 gap-4 cursor-pointer select-none active:bg-slate-50 ${isChecked ? 'opacity-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleCheck(survey.id, si.item_id, e.target.checked)}
                            className="w-5 h-5 rounded accent-emerald-600 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium text-slate-800 ${isChecked ? 'line-through' : ''}`}>
                              {si.items?.name ?? si.item_id}
                            </span>
                            <span className="text-slate-400 text-sm ml-1">· {si.items?.unit}</span>
                          </div>
                          <span className="shrink-0 text-lg font-bold text-slate-700 tabular-nums">
                            ×{si.qty_needed}
                          </span>
                        </label>
                      )
                    })}
                </div>
              )
            })}

            {/* Fully stocked stands */}
            {stockedSurveys.length > 0 && (
              <div className="mx-4 mt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Fully Stocked</p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {stockedSurveys.map(survey => (
                    <div key={survey.id} className="flex items-center px-4 py-3 gap-3">
                      <span className="text-emerald-500 text-lg">✓</span>
                      <span className="font-medium text-slate-700">{standName(survey)}</span>
                      <button
                        onClick={() => markPicked(survey.id)}
                        disabled={marking.has(survey.id)}
                        className="ml-auto text-xs text-slate-400 font-medium disabled:opacity-50"
                      >
                        {marking.has(survey.id) ? '…' : 'Done'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivered stands (status = picked) */}
            {pickedSurveys.length > 0 && (
              <div className="mx-4 mt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Delivered ({pickedSurveys.length})
                </p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 opacity-60">
                  {pickedSurveys.map(survey => {
                    const itemCount = (survey.survey_items ?? []).filter(si => si.qty_needed > 0).length
                    return (
                      <div key={survey.id} className="flex items-center px-4 py-3 gap-3">
                        <span className="text-emerald-500 text-lg">✓</span>
                        <div className="flex-1">
                          <div className="font-medium text-slate-700">{standName(survey)}</div>
                          <div className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} loaded</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ALL ITEMS (COLLATED) VIEW ───────────────────────────────── */}
        {viewMode === 'flat' && openSurveys.length > 0 && (
          <>
            {collatedItems.length === 0 ? (
              <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
                No items to load.
              </div>
            ) : (
              collatedItems.map(item => {
                const isChecked = flatChecked.has(item.id)

                return (
                  <div
                    key={item.id}
                    className={`mx-4 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-opacity ${isChecked ? 'opacity-50' : ''}`}
                  >
                    {/* Single checkbox row — item name + total qty */}
                    <label className="flex items-center px-4 py-3.5 bg-slate-50 border-b border-slate-100 gap-4 cursor-pointer select-none active:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => setFlatChecked(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(item.id) : next.delete(item.id)
                          return next
                        })}
                        className="w-5 h-5 rounded accent-emerald-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`font-bold text-slate-800 ${isChecked ? 'line-through' : ''}`}>
                          {item.name}
                        </span>
                        <span className="text-slate-400 text-sm font-normal ml-1.5">· {item.unit}</span>
                      </div>
                      <span className="shrink-0 text-2xl font-bold text-emerald-700 tabular-nums">
                        ×{item.totalQty}
                      </span>
                    </label>

                    {/* Stand breakdown — read-only reference for restocking */}
                    {item.stands
                      .sort((a, b) =>
                        (a.standNumber?.toString() ?? a.standName)
                          .localeCompare(b.standNumber?.toString() ?? b.standName)
                      )
                      .map((stand, i) => {
                        const label = stand.standNumber
                          ? `#${stand.standNumber} · ${stand.standName}`
                          : stand.standName
                        return (
                          <div
                            key={i}
                            className="flex items-center pl-12 pr-4 py-2.5 border-b border-slate-100 last:border-0"
                          >
                            <span className="flex-1 text-sm text-slate-500">{label}</span>
                            <span className="text-sm font-semibold text-slate-500 tabular-nums">×{stand.qty}</span>
                          </div>
                        )
                      })}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ── RECENT PICK LISTS ───────────────────────────────────────── */}
        {recentDates.length > 0 && (
          <div className="mx-4 mt-6 mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
              Recent Pick Lists
            </p>
            <div className="flex flex-col gap-3">
              {recentDates.map(date => {
                const surveys    = recentByDate[date]
                const isExpanded = expandedRecent.has(date)

                // Build the collated read-only view for this historical list
                const histMap = new Map()
                for (const survey of surveys) {
                  for (const si of (survey.survey_items ?? []).filter(si => si.qty_needed > 0)) {
                    if (!histMap.has(si.item_id)) {
                      histMap.set(si.item_id, {
                        id: si.item_id,
                        name: si.items?.name ?? si.item_id,
                        category: si.items?.category ?? '',
                        unit: si.items?.unit ?? '',
                        totalQty: 0,
                        stands: [],
                      })
                    }
                    const entry = histMap.get(si.item_id)
                    entry.totalQty += si.qty_needed
                    entry.stands.push({
                      standName: survey.stands?.name ?? '?',
                      standNumber: survey.stands?.number ?? null,
                      qty: si.qty_needed,
                    })
                  }
                }
                const histItems = Array.from(histMap.values()).sort((a, b) =>
                  a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
                )
                const totalItemsQty = histItems.reduce((sum, i) => sum + i.totalQty, 0)

                return (
                  <div key={date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Accordion header */}
                    <button
                      onClick={() => setExpandedRecent(prev => {
                        const next = new Set(prev)
                        isExpanded ? next.delete(date) : next.add(date)
                        return next
                      })}
                      className="w-full px-4 py-3.5 flex items-center justify-between active:bg-slate-50"
                    >
                      <div className="text-left">
                        <div className="font-semibold text-slate-800 text-sm">{date}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {surveys.length} stand{surveys.length !== 1 ? 's' : ''} · {totalItemsQty} items total
                        </div>
                      </div>
                      <span className="text-slate-400 text-sm ml-3">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Collated detail (read-only) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {histItems.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-slate-400">All stands were fully stocked.</p>
                        ) : (
                          histItems.map(item => (
                            <div key={item.id} className="border-b border-slate-100 last:border-0">
                              {/* Item row */}
                              <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50 border-b border-slate-50">
                                <div>
                                  <span className="font-semibold text-slate-700 text-sm">{item.name}</span>
                                  <span className="text-slate-400 text-xs ml-1.5">· {item.unit}</span>
                                </div>
                                <span className="font-bold text-slate-600 tabular-nums text-sm">×{item.totalQty}</span>
                              </div>
                              {/* Stand breakdown */}
                              {item.stands
                                .sort((a, b) =>
                                  (a.standNumber?.toString() ?? a.standName)
                                    .localeCompare(b.standNumber?.toString() ?? b.standName)
                                )
                                .map((stand, i) => {
                                  const label = stand.standNumber
                                    ? `#${stand.standNumber} · ${stand.standName}`
                                    : stand.standName
                                  return (
                                    <div key={i} className="px-6 py-2 flex items-center justify-between">
                                      <span className="text-sm text-slate-600">{label}</span>
                                      <span className="text-sm font-medium text-slate-500 tabular-nums">×{stand.qty}</span>
                                    </div>
                                  )
                                })}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No active list but has history */}
        {openSurveys.length === 0 && recentDates.length > 0 && (
          <div className="mx-4 mt-4 text-center">
            <p className="text-slate-400 text-sm mb-3">No active pick list.</p>
            <button
              onClick={() => navigate('/runner')}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm"
            >
              Go Survey Stands
            </button>
          </div>
        )}
      </div>

      {/* Close Pick List — sticky footer, visible while active list exists */}
      {openSurveys.length > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 pt-3 pb-safe">
          <button
            onClick={handleClose}
            disabled={closing}
            className="w-full py-4 border-2 border-slate-300 text-slate-600 rounded-2xl font-semibold text-base disabled:opacity-50 active:bg-slate-50"
          >
            {closing ? 'Closing…' : 'Close Pick List'}
          </button>
        </div>
      )}
    </div>
  )
}

// Returns "Stand Name" or "#N · Stand Name"
function standName(survey) {
  return survey.stands?.number
    ? `#${survey.stands.number} · ${survey.stands.name}`
    : (survey.stands?.name ?? '?')
}

function PickListHeader({ runnerName, navigate }) {
  return (
    <div className="bg-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
      <button onClick={() => navigate('/runner')} className="text-emerald-200 py-2.5 px-2 -my-1.5 text-sm">
        ← Runner
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base">Cart Pick List</div>
        {runnerName && <div className="text-emerald-200 text-xs">{runnerName}</div>}
      </div>
    </div>
  )
}
