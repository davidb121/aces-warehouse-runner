import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useToast } from '../hooks/useToast'
import { getSurveysForRunner, updateSurveyStatus } from '../lib/db'
import Toast from '../components/Toast'

export default function PickList() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { runnerId, runnerName } = session
  const { toast, showToast } = useToast()

  const [openSurveys, setOpenSurveys] = useState([])
  const [doneSurveys, setDoneSurveys] = useState([])
  const [checked, setChecked] = useState({})   // { [surveyId]: Set<itemId> }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'flat'
  const [showDone, setShowDone] = useState(false)
  const [marking, setMarking] = useState(new Set()) // surveyIds being marked

  const load = useCallback(async () => {
    if (!runnerId) return
    try {
      const all = await getSurveysForRunner(runnerId)
      const open = all.filter(s => s.status === 'open')
      const done = all.filter(s => s.status === 'picked' || s.status === 'done')
      setOpenSurveys(open)
      setDoneSurveys(done)
      // Keep existing checked state; only add keys for new surveys
      setChecked(prev => {
        const next = { ...prev }
        open.forEach(s => { if (!next[s.id]) next[s.id] = new Set() })
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

  function handleCheck(surveyId, itemId, value) {
    setChecked(prev => {
      const set = new Set(prev[surveyId] ?? [])
      value ? set.add(itemId) : set.delete(itemId)
      const next = { ...prev, [surveyId]: set }

      // Auto-complete if all items in this survey are now checked
      const survey = openSurveys.find(s => s.id === surveyId)
      const neededItems = (survey?.survey_items ?? []).filter(si => si.qty_needed > 0)
      if (neededItems.length > 0 && set.size >= neededItems.length) {
        markPicked(surveyId)
      }

      return next
    })
  }

  function handleMarkAll(surveyId) {
    const survey = openSurveys.find(s => s.id === surveyId)
    const neededItems = (survey?.survey_items ?? []).filter(si => si.qty_needed > 0)
    setChecked(prev => ({
      ...prev,
      [surveyId]: new Set(neededItems.map(si => si.item_id)),
    }))
    markPicked(surveyId)
  }

  // ── Derived data ────────────────────────────────────────────────────────

  // Surveys that have at least one needed item
  const surveysWithItems = openSurveys.filter(
    s => (s.survey_items ?? []).some(si => si.qty_needed > 0)
  )
  // Surveys with no needed items (runner surveyed but stand was stocked)
  const emptyOpenSurveys = openSurveys.filter(
    s => !(s.survey_items ?? []).some(si => si.qty_needed > 0)
  )

  // All items across all surveys (for flat view)
  const allFlatItems = surveysWithItems.flatMap(survey =>
    (survey.survey_items ?? [])
      .filter(si => si.qty_needed > 0)
      .map(si => ({ ...si, surveyId: survey.id, standName: survey.stands?.name ?? '?', standNumber: survey.stands?.number }))
  ).sort((a, b) =>
    (a.items?.category ?? '').localeCompare(b.items?.category ?? '') ||
    (a.items?.name ?? '').localeCompare(b.items?.name ?? '')
  )

  const totalNeeded = allFlatItems.length
  const totalChecked = Object.values(checked).reduce((sum, set) => sum + set.size, 0)

  // ── Loading / error ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <PickListHeader runnerName={runnerName} navigate={navigate} />
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading…</div>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────

  if (surveysWithItems.length === 0 && emptyOpenSurveys.length === 0) {
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

  // ── Main pick list ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <Toast message={toast} />
      <PickListHeader runnerName={runnerName} navigate={navigate} />

      {/* Progress + view toggle */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-slate-600">
          {totalChecked} / {totalNeeded} loaded
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

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm shrink-0">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto bg-slate-50 pb-6">

        {/* ── GROUPED VIEW ─────────────────────────────────────────── */}
        {viewMode === 'grouped' && (
          <>
            {surveysWithItems.map(survey => {
              const neededItems = (survey.survey_items ?? []).filter(si => si.qty_needed > 0)
              const standLabel = `${survey.stands?.number ? `#${survey.stands.number} · ` : ''}${survey.stands?.name ?? '?'}`
              const surveyChecked = checked[survey.id] ?? new Set()
              const allDone = surveyChecked.size >= neededItems.length
              const isMarking = marking.has(survey.id)

              return (
                <div key={survey.id} className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Stand header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">{standLabel}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {surveyChecked.size} / {neededItems.length} items loaded
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

                  {/* Item rows */}
                  {neededItems
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

            {/* Stocked stands (empty surveys) */}
            {emptyOpenSurveys.length > 0 && (
              <div className="mx-4 mt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Fully Stocked
                </p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {emptyOpenSurveys.map(survey => {
                    const standLabel = `${survey.stands?.number ? `#${survey.stands.number} · ` : ''}${survey.stands?.name ?? '?'}`
                    return (
                      <div key={survey.id} className="flex items-center px-4 py-3 gap-3">
                        <span className="text-emerald-500 text-lg">✓</span>
                        <span className="font-medium text-slate-700">{standLabel}</span>
                        <button
                          onClick={() => markPicked(survey.id)}
                          disabled={marking.has(survey.id)}
                          className="ml-auto text-xs text-slate-400 font-medium disabled:opacity-50"
                        >
                          {marking.has(survey.id) ? '…' : 'Done'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FLAT VIEW ────────────────────────────────────────────── */}
        {viewMode === 'flat' && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {allFlatItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No items to load.</div>
            ) : (
              allFlatItems.map((si, idx) => {
                const isChecked = (checked[si.surveyId] ?? new Set()).has(si.item_id)
                const standLabel = `${si.standNumber ? `#${si.standNumber} · ` : ''}${si.standName}`
                return (
                  <label
                    key={`${si.surveyId}-${si.item_id}`}
                    className={`flex items-center px-4 py-3.5 border-b border-slate-100 last:border-0 gap-4 cursor-pointer select-none active:bg-slate-50 ${isChecked ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => handleCheck(si.surveyId, si.item_id, e.target.checked)}
                      className="w-5 h-5 rounded accent-emerald-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-slate-800 ${isChecked ? 'line-through' : ''}`}>
                        {si.items?.name ?? si.item_id}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{standLabel}</div>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-slate-700 tabular-nums">
                      ×{si.qty_needed}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        )}

        {/* ── Done / Picked surveys ─────────────────────────────────── */}
        {doneSurveys.length > 0 && (
          <div className="mx-4 mt-6">
            <button
              onClick={() => setShowDone(s => !s)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wide py-1 mb-2"
            >
              <span>Loaded ({doneSurveys.length} stand{doneSurveys.length !== 1 ? 's' : ''})</span>
              <span>{showDone ? '▲' : '▼'}</span>
            </button>
            {showDone && (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 opacity-60">
                {doneSurveys.map(survey => {
                  const standLabel = `${survey.stands?.number ? `#${survey.stands.number} · ` : ''}${survey.stands?.name ?? '?'}`
                  const itemCount = (survey.survey_items ?? []).filter(si => si.qty_needed > 0).length
                  return (
                    <div key={survey.id} className="flex items-center px-4 py-3 gap-3">
                      <span className="text-emerald-500 text-lg">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-700">{standLabel}</div>
                        <div className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} loaded</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
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
