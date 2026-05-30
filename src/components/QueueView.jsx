import { useState, useEffect, useCallback } from 'react'
import {
  getOpenRequests,
  getRecentDoneRequests,
  acceptRequest,
  completeRequest,
} from '../lib/db'
import { useRealtimeQueue } from '../hooks/useRealtimeQueue'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
import RequestCard from './RequestCard'
import RequestForm from './RequestForm'
import StandPicker from './StandPicker'

// createView: null | 'pick-stand' | { id, name } (stand object for the form)
export default function QueueView({ runnerId, runnerName }) {
  const [openReqs, setOpenReqs] = useState([])
  const [myReqs, setMyReqs] = useState([])
  const [doneReqs, setDoneReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [accepting, setAccepting] = useState(new Set())
  const [completing, setCompleting] = useState(new Set())
  const [createView, setCreateView] = useState(null)
  const { toast, showToast } = useToast()

  const refresh = useCallback(async () => {
    try {
      const [active, done] = await Promise.all([
        getOpenRequests(),
        getRecentDoneRequests(15),
      ])
      setOpenReqs(active.filter(r => r.status === 'open'))
      setMyReqs(active.filter(r => r.status === 'accepted' && r.accepted_by === runnerId))
      setDoneReqs(done)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [runnerId])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useRealtimeQueue(refresh)

  async function handleAccept(requestId) {
    setAccepting(prev => new Set(prev).add(requestId))
    try {
      const won = await acceptRequest(requestId, runnerId)
      if (won) {
        showToast('Request accepted!')
      } else {
        showToast('Already taken by another runner')
      }
      await refresh()
    } catch (e) {
      showToast(e.message)
    } finally {
      setAccepting(prev => { const n = new Set(prev); n.delete(requestId); return n })
    }
  }

  async function handleComplete(requestId) {
    setCompleting(prev => new Set(prev).add(requestId))
    try {
      await completeRequest(requestId)
      showToast('Marked done!')
      await refresh()
    } catch (e) {
      showToast(e.message)
    } finally {
      setCompleting(prev => { const n = new Set(prev); n.delete(requestId); return n })
    }
  }

  function handleCreateSuccess() {
    setCreateView(null)
    showToast('Request sent!')
    refresh()
  }

  // ── Create request: stand picker ────────────────────────────────────────
  if (createView === 'pick-stand') {
    return (
      <div className="flex flex-col min-h-full">
        <StandPicker
          title="Pick a Stand to Request For"
          onSelect={stand => setCreateView({ id: stand.id, name: stand.name })}
          onCancel={() => setCreateView(null)}
        />
      </div>
    )
  }

  // ── Create request: item form ───────────────────────────────────────────
  if (createView && typeof createView === 'object') {
    return (
      <div className="flex flex-col min-h-full bg-slate-50">
        <div className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <p className="text-xs text-slate-500">New request for</p>
          <p className="font-bold text-slate-800">{createView.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RequestForm
            standId={createView.id}
            standName={createView.name}
            createdBy={`runner:${runnerName}`}
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateView(null)}
          />
        </div>
      </div>
    )
  }

  // ── Main queue view ─────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading queue…</div>
  }

  const hasAnything = openReqs.length > 0 || myReqs.length > 0

  return (
    <div className="pb-6">
      <Toast message={toast} />

      {/* Create request button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => setCreateView('pick-stand')}
          className="w-full py-3 border-2 border-dashed border-emerald-400 text-emerald-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:bg-emerald-50"
        >
          + Create Request
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>
      )}

      {/* My Active section */}
      {myReqs.length > 0 && (
        <section className="px-4 pt-2 pb-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            My Active ({myReqs.length})
          </h2>
          <div className="flex flex-col gap-3">
            {myReqs.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                actions={[{
                  label: 'Mark Done',
                  variant: 'done',
                  loading: completing.has(req.id),
                  onClick: () => handleComplete(req.id),
                }]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Open section */}
      <section className="px-4 pt-2 pb-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
          Open {openReqs.length > 0 ? `(${openReqs.length})` : ''}
        </h2>
        {openReqs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
            {hasAnything ? 'No other open requests.' : 'No open requests right now.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {openReqs.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                actions={[{
                  label: 'Accept',
                  loading: accepting.has(req.id),
                  onClick: () => handleAccept(req.id),
                }]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recently Done section */}
      {doneReqs.length > 0 && (
        <section className="px-4 pt-0 pb-4">
          <button
            onClick={() => setShowDone(s => !s)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 py-1"
          >
            <span>Recently Done ({doneReqs.length})</span>
            <span>{showDone ? '▲' : '▼'}</span>
          </button>
          {showDone && (
            <div className="flex flex-col gap-3">
              {doneReqs.map(req => (
                <RequestCard
                  key={req.id}
                  request={req}
                  showStatus
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
