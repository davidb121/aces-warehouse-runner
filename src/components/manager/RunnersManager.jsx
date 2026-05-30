import { useState, useEffect, useRef } from 'react'
import { getAllRunners, upsertRunner, deactivateRunner } from '../../lib/db'
import { useToast } from '../../hooks/useToast'
import Toast from '../Toast'

const EMPTY = { name: '' }

export default function RunnersManager() {
  const [runners, setRunners] = useState([])
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
      setRunners(await getAllRunners())
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

  function openEdit(runner) {
    setEditId(runner.id)
    setForm({ name: runner.name })
    setShowForm(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  function patchRunners(saved) {
    setRunners(prev => {
      const idx = prev.findIndex(r => r.id === saved.id)
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
      const payload = { name: form.name.trim(), is_active: true }
      if (editId) payload.id = editId
      const saved = await upsertRunner(payload)
      patchRunners(saved)
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
      showToast(`"${saved.name}" added`)
      setForm(EMPTY)
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }

  async function handleDeactivate(runner) {
    try {
      await deactivateRunner(runner.id)
      patchRunners({ ...runner, is_active: false })
      showToast(`"${runner.name}" deactivated`)
      if (editId === runner.id) closeForm()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleReactivate(runner) {
    try {
      const saved = await upsertRunner({ ...runner, is_active: true })
      patchRunners(saved)
      showToast(`"${runner.name}" reactivated`)
    } catch (e) {
      setError(e.message)
    }
  }

  const visible = runners
    .filter(r => showInactive || r.is_active)
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
          Show inactive ({runners.filter(r => !r.is_active).length})
        </label>
        <span className="text-sm text-slate-500">{runners.filter(r => r.is_active).length} active</span>
        {!showForm && (
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + Add
          </button>
        )}
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>}

      {showForm && (
        <div className="mx-4 my-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="font-semibold text-slate-700 mb-3">{editId ? 'Edit Runner' : 'New Runner'}</p>
          <div className="flex flex-col gap-3">
            <input
              ref={nameRef}
              type="text"
              placeholder="Runner name (e.g. Sam)"
              value={form.name}
              onChange={e => setForm({ name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && !editId && handleSaveAnother()}
              className="border border-slate-300 rounded-lg px-3 py-3 text-base outline-none focus:border-blue-500 w-full"
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
                onClick={() => handleDeactivate(runners.find(r => r.id === editId))}
                className="py-2 text-red-500 text-sm font-medium text-center"
              >
                Deactivate this runner
              </button>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {visible.length === 0 && !showForm && (
          <div className="px-4 py-10 text-center text-slate-400">
            No runners yet. Add the 5 runner names here.
          </div>
        )}
        {visible.map(runner => (
          <div key={runner.id} className={`flex items-center px-4 py-4 gap-3 ${!runner.is_active ? 'opacity-40' : ''}`}>
            <div className="flex-1">
              <div className="font-medium text-slate-800 text-lg">{runner.name}</div>
            </div>
            {runner.is_active ? (
              <button
                onClick={() => openEdit(runner)}
                className="shrink-0 px-3 py-2 text-sm text-blue-600 font-medium"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(runner)}
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
