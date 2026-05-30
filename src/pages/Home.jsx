import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function getPlatform() {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

export default function Home() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [showHint, setShowHint] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const platform = getPlatform()

  useEffect(() => {
    if (!isStandalone() && !localStorage.getItem('pwa_hint_dismissed')) {
      setShowHint(true)
    }

    // Grab Android's deferred install prompt (captured in index.html before React loads)
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt)
    }

    function onInstallPrompt(e) {
      e.preventDefault()
      window.__pwaInstallPrompt = e
      setInstallPrompt(e)
      if (!localStorage.getItem('pwa_hint_dismissed')) setShowHint(true)
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)

    // Hide hint once installed
    window.addEventListener('appinstalled', dismissHint)

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      window.removeEventListener('appinstalled', dismissHint)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint() {
    localStorage.setItem('pwa_hint_dismissed', '1')
    setShowHint(false)
  }

  async function handleAndroidInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      dismissHint()
    }
  }

  function goStand() {
    setSession({ role: 'stand' })
    navigate('/stand')
  }

  function goRunner() {
    setSession({ role: 'runner' })
    navigate('/runner')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 gap-6">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold text-blue-900">Aces Warehouse Runner</h1>
        <p className="text-slate-500 mt-1 text-sm">Greater Nevada Field · Concession Restocking</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <button
          onClick={goStand}
          className="w-full py-5 text-xl font-semibold bg-blue-600 text-white rounded-2xl active:bg-blue-700 shadow-sm"
        >
          I&apos;m a Stand Worker
          {session.role === 'stand' && session.standName && (
            <div className="text-sm font-normal opacity-80 mt-0.5">{session.standName}</div>
          )}
        </button>
        <button
          onClick={goRunner}
          className="w-full py-5 text-xl font-semibold bg-emerald-600 text-white rounded-2xl active:bg-emerald-700 shadow-sm"
        >
          I&apos;m a Runner
          {session.role === 'runner' && session.runnerName && (
            <div className="text-sm font-normal opacity-80 mt-0.5">{session.runnerName}</div>
          )}
        </button>
        <button
          onClick={() => navigate('/manager')}
          className="w-full py-5 text-xl font-semibold bg-slate-700 text-white rounded-2xl active:bg-slate-800 shadow-sm"
        >
          Manager
        </button>
      </div>

      {showHint && (
        <div className="fixed bottom-4 left-4 right-4 bg-slate-800 text-white rounded-2xl p-4 shadow-xl z-50">
          {platform === 'android' && installPrompt ? (
            /* Android Chrome — native install dialog */
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">Install App</p>
                <p className="text-xs text-slate-300 mt-0.5">Add to your home screen for fast access.</p>
              </div>
              <button
                onClick={handleAndroidInstall}
                className="shrink-0 bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-600"
              >
                Install
              </button>
              <button onClick={dismissHint} className="text-slate-400 text-2xl leading-none shrink-0 -mr-1">
                &times;
              </button>
            </div>
          ) : platform === 'ios' ? (
            /* iOS Safari — manual instructions */
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">Add to Home Screen</p>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Tap <span className="font-bold text-white">⬆ Share</span> at the bottom of Safari,
                  then <span className="font-bold text-white">&ldquo;Add to Home Screen&rdquo;</span>.
                </p>
              </div>
              <button onClick={dismissHint} className="text-slate-400 text-2xl leading-none -mt-0.5 shrink-0">
                &times;
              </button>
            </div>
          ) : (
            /* Generic fallback */
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">Add to Home Screen</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Install this app for quick access on game day.
                </p>
              </div>
              <button onClick={dismissHint} className="text-slate-400 text-2xl leading-none -mt-0.5 shrink-0">
                &times;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
