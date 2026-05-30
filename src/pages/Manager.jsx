import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ItemsManager from '../components/manager/ItemsManager'
import StandsManager from '../components/manager/StandsManager'
import CatalogEditor from '../components/manager/CatalogEditor'
import RunnersManager from '../components/manager/RunnersManager'

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'stands', label: 'Stands' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'runners', label: 'Runners' },
]

export default function Manager() {
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [tab, setTab] = useState('items')

  const expectedPin = import.meta.env.VITE_MANAGER_PIN ?? '1234'

  function handlePinSubmit(e) {
    e.preventDefault()
    if (pin === expectedPin) {
      setUnlocked(true)
      setPin('')
    } else {
      setPinError(true)
      setPin('')
      setTimeout(() => setPinError(false), 2000)
    }
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-6 px-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-slate-800">Manager Access</h1>
        </div>
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            placeholder="Enter PIN"
            value={pin}
            autoFocus
            onChange={e => setPin(e.target.value)}
            className={`w-full text-center text-3xl tracking-[0.5em] border-2 rounded-xl py-4 px-4 outline-none transition-colors ${
              pinError ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-300 focus:border-blue-500'
            }`}
          />
          {pinError && (
            <p className="text-red-500 text-center text-sm -mt-2">Incorrect PIN</p>
          )}
          <button
            type="submit"
            disabled={!pin}
            className="w-full py-4 bg-slate-700 text-white text-lg font-semibold rounded-xl active:bg-slate-800 disabled:opacity-50"
          >
            Unlock
          </button>
        </form>
        <button onClick={() => navigate('/')} className="text-blue-600 text-sm underline">
          ← Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-300 text-sm py-2.5 px-2 -my-1.5">
          ← Home
        </button>
        <span className="font-bold text-base">Manager</span>
        <button
          onClick={() => setUnlocked(false)}
          className="text-slate-300 text-sm py-2.5 px-2 -my-1.5"
        >
          Lock
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {tab === 'items' && <ItemsManager />}
        {tab === 'stands' && <StandsManager />}
        {tab === 'catalog' && <CatalogEditor />}
        {tab === 'runners' && <RunnersManager />}
      </div>
    </div>
  )
}
