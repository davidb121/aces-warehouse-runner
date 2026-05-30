import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStands } from '../lib/db'

export default function StandPicker({ onSelect, onCancel, title = 'Select Your Stand' }) {
  const navigate = useNavigate()
  const [stands, setStands] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStands()
      .then(setStands)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = stands.filter(s =>
    !filter ||
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    (s.number ?? '').includes(filter)
  )

  return (
    <>
      <div className="px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          {onCancel && (
            <button onClick={onCancel} className="text-blue-600 text-sm font-medium">
              Cancel
            </button>
          )}
        </div>
        <input
          type="search"
          placeholder="Search stands…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base outline-none focus:border-blue-500"
        />
        <button
          onClick={() => navigate('/scan')}
          className="w-full mt-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium text-sm flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <span>📷</span> Scan QR Code
        </button>
      </div>

      {error && <div className="px-4 py-2 text-red-600 text-sm bg-red-50">{error}</div>}

      {loading && (
        <div className="p-8 text-center text-slate-400">Loading stands…</div>
      )}

      <div className="divide-y divide-slate-100">
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-slate-400">
            {stands.length === 0
              ? 'No stands in database. Add stands via the Manager screen.'
              : 'No stands match your search.'}
          </div>
        )}
        {filtered.map(stand => (
          <button
            key={stand.id}
            onClick={() => onSelect(stand)}
            className="w-full flex items-center px-4 py-4 text-left gap-3 active:bg-slate-50"
          >
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 text-lg truncate">
                {stand.number ? `#${stand.number} · ` : ''}{stand.name}
              </div>
              {stand.location_note && (
                <div className="text-sm text-slate-400 mt-0.5 truncate">{stand.location_note}</div>
              )}
            </div>
            <span className="text-slate-300 text-2xl shrink-0">›</span>
          </button>
        ))}
      </div>
    </>
  )
}
