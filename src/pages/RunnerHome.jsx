import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useOpenRequestCount } from '../hooks/useOpenRequestCount'
import { getRunners } from '../lib/db'
import QueueView from '../components/QueueView'
import StandPicker from '../components/StandPicker'

export default function RunnerHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, setSession } = useSession()
  const { runnerId, runnerName } = session

  const defaultTab = location.pathname.includes('queue') ? 'queue' : 'survey'
  const [tab, setTab] = useState(defaultTab)

  const [runners, setRunners] = useState([])
  const [loadingRunners, setLoadingRunners] = useState(true)
  const [runnersError, setRunnersError] = useState(null)

  // Live open-request count for the banner + browser notifications
  const openCount = useOpenRequestCount()

  useEffect(() => {
    if (!runnerId) {
      getRunners()
        .then(setRunners)
        .catch(e => setRunnersError(e.message))
        .finally(() => setLoadingRunners(false))
    }
  }, [runnerId])

  // Ask for notification permission once the runner has identified themselves
  useEffect(() => {
    if (!runnerId) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [runnerId])

  function selectRunner(runner) {
    setSession({ runnerId: runner.id, runnerName: runner.name, role: 'runner' })
  }

  function changeRunner() {
    setSession({ runnerId: null, runnerName: null })
  }

  // ── Runner picker ───────────────────────────────────────────────────────
  if (!runnerId) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/')} className="text-emerald-200 py-2.5 px-2 -my-1.5 text-sm">
            ← Home
          </button>
          <span className="font-bold text-base">Runner</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="px-4 py-6">
            <p className="text-center text-slate-500 text-sm mb-6">Who are you?</p>
            {runnersError && (
              <div className="mb-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">{runnersError}</div>
            )}
            {loadingRunners && (
              <div className="text-center text-slate-400">Loading…</div>
            )}
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              {runners.map(runner => (
                <button
                  key={runner.id}
                  onClick={() => selectRunner(runner)}
                  className="w-full py-5 text-2xl font-semibold text-slate-800 bg-white rounded-2xl border-2 border-slate-200 active:border-emerald-500 active:bg-emerald-50 shadow-sm"
                >
                  {runner.name}
                </button>
              ))}
              {!loadingRunners && runners.length === 0 && (
                <div className="text-center text-slate-400 py-6 text-sm">
                  No runners in the database. Add runner names via Manager → Runners.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Runner home with tabs ───────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="text-emerald-200 py-2.5 px-2 -my-1.5 text-sm">
          ← Home
        </button>
        <span className="font-bold text-base flex-1">{runnerName}</span>
        <button onClick={changeRunner} className="text-emerald-200 text-sm py-2.5 px-2 -my-1.5 shrink-0">
          Change
        </button>
      </div>

      {/* Open-request banner — only shown on Survey tab so it doesn't duplicate the queue */}
      {openCount > 0 && tab === 'survey' && (
        <button
          onClick={() => setTab('queue')}
          className="w-full bg-amber-500 active:bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0"
        >
          <span className="text-sm font-semibold">
            {openCount} open request{openCount !== 1 ? 's' : ''} waiting
          </span>
          <span className="text-sm font-bold">View Queue →</span>
        </button>
      )}

      <div className="flex border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setTab('survey')}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
            tab === 'survey' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'
          }`}
        >
          Survey
        </button>
        <button
          onClick={() => setTab('queue')}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
            tab === 'queue' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'
          }`}
        >
          Queue{openCount > 0 ? ` (${openCount})` : ''}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        {tab === 'survey' && <SurveyTab runnerName={runnerName} />}
        {tab === 'queue' && <QueueView runnerId={runnerId} runnerName={runnerName} />}
      </div>
    </div>
  )
}

// SurveyTab is a proper component so it can hold its own state and hooks
function SurveyTab({ runnerName }) {
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)

  if (picking) {
    return (
      <StandPicker
        title="Pick a Stand to Survey"
        onSelect={stand => navigate(`/runner/survey/${stand.id}`, { state: { standName: stand.name } })}
        onCancel={() => setPicking(false)}
      />
    )
  }

  return (
    <div className="flex flex-col items-center px-6 py-10 gap-5">
      <div className="text-center">
        <div className="text-4xl mb-2">📋</div>
        <h2 className="text-xl font-bold text-slate-700">Pre-Game Survey</h2>
        <p className="text-slate-400 text-sm mt-1">Survey a stand to build your cart pick list</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => setPicking(true)}
          className="w-full py-5 text-lg font-bold bg-emerald-600 text-white rounded-2xl active:bg-emerald-700 shadow"
        >
          Survey a Stand
        </button>
        <button
          onClick={() => navigate('/runner/picklist')}
          className="w-full py-4 text-base font-semibold border-2 border-emerald-600 text-emerald-700 rounded-2xl active:bg-emerald-50"
        >
          View Cart Pick List
        </button>
      </div>
    </div>
  )
}
