import { useState, useEffect, useRef } from 'react'
import { getAllItems, upsertItem, deactivateItem } from '../../lib/db'
import { useToast } from '../../hooks/useToast'
import Toast from '../Toast'

const CATEGORIES = ['soda', 'beer', 'candy', 'frozen', 'food', 'bakery', 'other']
const UNITS = ['case', 'each', 'bag', 'box']
const EMPTY = { name: '', category: 'soda', unit: 'case' }

export default function ItemsManager() {
  const [items, setItems] = useState([])
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
      setItems(await getAllItems())
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

  function openEdit(item) {
    setEditId(item.id)
    setForm({ name: item.name, category: item.category ?? 'other', unit: item.unit ?? 'case' })
    setShowForm(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY)
  }

  function patchItems(saved) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
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
      const payload = { name: form.name.trim(), category: form.category, unit: form.unit, is_active: true }
      if (editId) payload.id = editId
      const saved = await upsertItem(payload)
      patchItems(saved)
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
      setForm(prev => ({ ...EMPTY, category: prev.category, unit: prev.unit }))
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }

  async function handleDeactivate(item) {
    try {
      await deactivateItem(item.id)
      patchItems({ ...item, is_active: false })
      showToast(`"${item.name}" deactivated`)
      if (editId === item.id) closeForm()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleReactivate(item) {
    try {
      const saved = await upsertItem({ ...item, is_active: true })
      patchItems(saved)
      showToast(`"${item.name}" reactivated`)
    } catch (e) {
      setError(e.message)
    }
  }

  const visible = items
    .filter(i => showInactive || i.is_active)
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)
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
          Show inactive ({items.filter(i => !i.is_active).length})
        </label>
        <span className="text-sm text-slate-500">{items.filter(i => i.is_active).length} active</span>
        {!showForm && (
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + Add
          </button>
        )}
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>}

      {showForm && (
        <div className="mx-4 my-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="font-semibold text-slate-700 mb-3">{editId ? 'Edit Item' : 'New Item'}</p>
          <div className="flex flex-col gap-3">
            <input
              ref={nameRef}
              type="text"
              placeholder="Item name (e.g. Coke 12-pack)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && !editId && handleSaveAnother()}
              className="border border-slate-300 rounded-lg px-3 py-3 text-base outline-none focus:border-blue-500 w-full"
            />
            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-3 text-base bg-white outline-none focus:border-blue-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <select
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-3 text-base bg-white outline-none focus:border-blue-500"
              >
                {UNITS.map(u => (
                  <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>
                ))}
              </select>
            </div>
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
                onClick={() => handleDeactivate(items.find(i => i.id === editId))}
                className="py-2 text-red-500 text-sm font-medium text-center"
              >
                Deactivate this item
              </button>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {visible.length === 0 && !showForm && (
          <div className="px-4 py-10 text-center text-slate-400">
            No items yet. Tap + Add to get started.
          </div>
        )}
        {visible.map(item => (
          <div key={item.id} className={`flex items-center px-4 py-3 gap-3 ${!item.is_active ? 'opacity-40' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 truncate">{item.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{item.category} · {item.unit}</div>
            </div>
            {item.is_active ? (
              <button
                onClick={() => openEdit(item)}
                className="shrink-0 px-3 py-2 text-sm text-blue-600 font-medium"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(item)}
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
