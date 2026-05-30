import { useState, useEffect, useRef } from 'react'
import { getAllStands, upsertStand, deactivateStand } from '../../lib/db'
import { useToast } from '../../hooks/useToast'
import Toast from '../Toast'

const TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'mobile', label: 'Mobile / Kiosk' },
  { value: 'third_party', label: 'Third Party' },
]
const EMPTY = { name: '', number: '', stand_type: 'permanent', location_note: '' }

export default function StandsManager() {
  const [stands, setStands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const { toast, showToast } = useToast()
  const nameRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setStands(await getAllStands())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditId(null)
    setForm(EMPTY)
    setShowForm(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  function openEdit(stand) {
    setEditId(stand.id)
    setForm({
      name: stand.name,
      number: stand.number ?? '',
      stand_type: stand.stand_type ?? 'permanent',
      location_note: stand.location_note ?? '',
    })
    setShowForm(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  function patchStands(saved) {
    setStands(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }

  async function doSave() {
    if (!form.name.trim()) return null
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        number: form.number.trim() || null,
        stand_type: form.stand_type,
        location_note: form.location_note.trim() || null,
        is_active: true,
      }
      if (editId) payload.id = editId
      const saved = await upsertStand(payload)
      patchStands(saved)
      return saved
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveClose() {
    const saved = await doSave()
    if (saved) {
      showToast(`"${saved.name}" saved`)
      closeForm()
    }
  }

  async function handleSaveAnother() {
    const saved = await doSave()
    if (saved) {
      showToast(`"${saved.name}" saved`)
      setForm(prev => ({ ...EMPTY, stand_type: prev.stand_type }))
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }

  async function handleDeactivate(stand) {
    try {
      await deactivateStand(stand.id)
      patchStands({ ...stand, is_active: false })
      showToast(`"${stand.name}" deactivated`)
      if (editId === stand.id) closeForm()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleReactivate(stand) {
    try {
      const saved = await upsertStand({ ...stand, is_active: true })
      patchStands(saved)
      showToast(`"${stand.name}" reactivated`)
    } catch (e) {
      setError(e.message)
    }
  }

  const visible = stands
    .filter(s => showInactive || s.is_active)
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  if (loading) return <div className="p-6 text-slate-500 text-center">Loading…</div>

  return (
    <div className="pb-24">
      <Toast message={toast} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white sticky top-0">
        <label className="flex items-center gap-2 text-sm text-slate-500 select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4"
          />
          Show inactive ({stands.filter(s => !s.is_active).length})
        </label>
        <span className="text-sm text-slate-500">{stands.filter(s => s.is_active).length} active</span>
        {!showForm && (
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + Add
          </button>
        )}
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>}

      {showForm && (
        <div className="mx-4 my-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="font-semibold text-slate-700 mb-3">{editId ? 'Edit Stand' : 'New Stand'}</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={nameRef}
                type="text"
                placeholder="Stand name (e.g. Stand 3 / Blaze Pizza)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-3 text-base outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="#"
                value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                className="w-16 border border-slate-300 rounded-lg px-3 py-3 text-base outline-none focus:border-blue-500 text-center"
              />
            </div>
            <select
              value={form.stand_type}
              onChange={e => setForm(f => ({ ...f, stand_type: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-3 text-base bg-white outline-none focus:border-blue-500"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              placeholder="Location note (optional, e.g. Main concourse, 3rd base)"
              value={form.location_note}
              onChange={e => setForm(f => ({ ...f, location_note: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-3 text-base outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              {!editId && (
                <button
                  onClick={handleSaveAnother}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
                >
                  Save & Add Another
                </button>
              )}
              <button
                onClick={handleSaveClose}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                {editId ? 'Save' : 'Save & Close'}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
            {editId && (
              <button
                onClick={() => handleDeactivate(stands.find(s => s.id === editId))}
                className="py-2 text-red-500 text-sm font-medium text-center"
              >
                Deactivate this stand
              </button>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {visible.length === 0 && !showForm && (
          <div className="px-4 py-10 text-center text-slate-400">
            No stands yet. Tap + Add to get started.
          </div>
        )}
        {visible.map(stand => (
          <div key={stand.id} className={`flex items-center px-4 py-3 gap-3 ${!stand.is_active ? 'opacity-40' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 truncate">
                {stand.number ? `#${stand.number} · ` : ''}{stand.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {TYPES.find(t => t.value === stand.stand_type)?.label ?? stand.stand_type}
                {stand.location_note ? ` · ${stand.location_note}` : ''}
              </div>
            </div>
            {stand.is_active ? (
              <button
                onClick={() => openEdit(stand)}
                className="shrink-0 px-3 py-2 text-sm text-blue-600 font-medium"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(stand)}
                className="shrink-0 px-3 py-2 text-sm text-slate-500 font-medium"
              >
                Restore
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
