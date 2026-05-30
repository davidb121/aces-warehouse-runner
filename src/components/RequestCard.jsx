function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

const STATUS_STYLE = {
  open:      'bg-amber-100 text-amber-700',
  accepted:  'bg-blue-100 text-blue-700',
  done:      'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_LABEL = {
  open: 'Open',
  accepted: 'Accepted',
  done: 'Done',
  cancelled: 'Cancelled',
}

// actions: [{ label, onClick, loading?, variant? }]
// variant: 'primary' (default blue) | 'done' (green) | 'danger' (red outline)
export default function RequestCard({ request, actions = [], showStatus = false }) {
  const { stands, request_items = [], runners, created_at, note, status, created_by } = request
  const standLabel = stands
    ? `${stands.number ? `#${stands.number} · ` : ''}${stands.name}`
    : 'Unknown stand'
  const acceptedByName = runners?.name

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-base truncate">{standLabel}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {timeAgo(created_at)} · {created_by}
          </div>
        </div>
        {showStatus && (
          <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[status] ?? ''}`}>
            {STATUS_LABEL[status] ?? status}
            {status === 'accepted' && acceptedByName ? ` · ${acceptedByName}` : ''}
          </span>
        )}
      </div>

      {/* Items as chips */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {request_items.map(ri => (
          <span
            key={ri.id}
            className="bg-slate-100 text-slate-700 text-sm px-2.5 py-1 rounded-full font-medium"
          >
            {ri.items?.name ?? '?'} × {ri.qty}
          </span>
        ))}
      </div>

      {/* Note */}
      {note && (
        <p className="text-sm text-slate-500 italic mt-1.5">&ldquo;{note}&rdquo;</p>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.loading || action.disabled}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 active:opacity-80 transition-opacity ${
                action.variant === 'done'
                  ? 'bg-emerald-600 text-white'
                  : action.variant === 'danger'
                  ? 'border border-red-300 text-red-600'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {action.loading ? '…' : action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
