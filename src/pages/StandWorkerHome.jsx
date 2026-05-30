import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useRealtimeQueue } from '../hooks/useRealtimeQueue'
import { useToast } from '../hooks/useToast'
import { getRequestsForStand } from '../lib/db'
import StandPicker from '../components/StandPicker'
import RequestForm from '../components/RequestForm'
import RequestCard from '../components/RequestCard'
import Toast from '../components/Toast'

// view: 'home' | 'form'
export default function StandWorkerHome() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const { standId, standName } = session
  const [view, setView] = useState('home')
  const [requests, setRequests] = useState([])
  const [loadingReqs, setLoadingReqs] = useState(false)
  const { toast, showToast } = useToast()

  function handleStandSelect(stand) {
    setSession({ standId: stand.id, standName: stand.name, role: 'stand' })
  }

  function changeStand() {
    setSession({ standId: null, standName: null })
    setView('home')
  }

  const refreshRequests = useCallback(async () => {
    if (!standId) return
    try {
      setRequests(await getRequestsForStand(standId, 10))
    } catch {
      // non-fatal
    }
  }, [standId])

  useEffect(() => {
    if (standId) {
      setLoadingReqs(true)
      refreshRequests().finally(() => setLoadingReqs(false))
    }
  }, [standId, refreshRequests])

  useRealtimeQueue(refreshRequests)

  function handleFormSuccess() {
    setView('home')
    showToast('Request sent!')
    refreshRequests()
  }

  // ── Stand picker ────────────────────────────────────────────────────────
  if (!standId) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/')} className="text-blue-200 py-2.5 px-2 -my-1.5 text-sm">
            ← Home
          </button>
          <span className="font-bold text-base flex-1">Stand Worker</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <StandPicker onSelect={handleStandSelect} />
        </div>
      </div>
    )
  }

  // ── Request form ────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setView('home')} className="text-blue-200 py-2.5 px-2 -my-1.5 text-sm">
            ← Back
          </button>
          <span className="font-bold text-base flex-1 truncate">Request Restock · {standName}</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <RequestForm
            standId={standId}
            standName={standName}
            createdBy={`stand:${standName}`}
            onSuccess={handleFormSuccess}
            onCancel={() => setView('home')}
          />
        </div>
      </div>
    )
  }

  // ── Stand home ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <Toast message={toast} />
      <div className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="text-blue-200 py-2.5 px-2 -my-1.5 text-sm">
          ← Home
        </button>
        <span className="font-bold text-base flex-1 truncate">{standName}</span>
        <button onClick={changeStand} className="text-blue-200 text-sm py-2.5 px-2 -my-1.5 shrink-0">
          Change
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        {/* Primary action */}
        <div className="px-4 pt-6 pb-4">
          <button
            onClick={() => setView('form')}
            className="w-full py-5 text-xl font-bold bg-blue-600 text-white rounded-2xl active:bg-blue-700 shadow"
          >
            Request Restock
          </button>
        </div>

        {/* Recent requests */}
        <div className="px-4 pb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            Recent Requests
          </h2>

          {loadingReqs && (
            <div className="text-center text-slate-400 py-4 text-sm">Loading…</div>
          )}

          {!loadingReqs && requests.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
              No requests yet. Tap &ldquo;Request Restock&rdquo; to create one.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {requests.map(req => (
              <RequestCard key={req.id} request={req} showStatus />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
