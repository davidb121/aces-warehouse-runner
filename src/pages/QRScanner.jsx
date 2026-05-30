import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { getStands } from '../lib/db'
import { useSession } from '../hooks/useSession'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const READER_ID = 'qr-reader'

export default function QRScanner() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [status, setStatus] = useState('starting') // 'starting'|'scanning'|'resolving'|'error'
  const [camError, setCamError] = useState(null)
  const [transientMsg, setTransientMsg] = useState(null)
  const qrRef = useRef(null)
  const resolvedRef = useRef(false)
  const transientTimer = useRef(null)

  function showTransient(msg) {
    setTransientMsg(msg)
    clearTimeout(transientTimer.current)
    transientTimer.current = setTimeout(() => setTransientMsg(null), 2500)
  }

  useEffect(() => {
    let qr

    async function init() {
      try {
        qr = new Html5Qrcode(READER_ID)
        qrRef.current = qr

        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            if (resolvedRef.current) return

            // Extract UUID from whatever the QR contains
            const match = decoded.match(UUID_RE)
            if (!match) {
              showTransient('Not a stand QR code — keep trying')
              return
            }

            resolvedRef.current = true
            setStatus('resolving')
            await qr.stop().catch(() => {})

            try {
              const standId = match[0]
              const stands = await getStands()
              const stand = stands.find(s => s.id === standId)

              if (!stand) {
                setCamError(`Stand not found. Is the database set up? (ID: ${standId.slice(0, 8)}…)`)
                setStatus('error')
                return
              }

              if (session.role === 'runner') {
                navigate(`/runner/survey/${stand.id}`, { replace: true })
              } else {
                setSession({ standId: stand.id, standName: stand.name })
                navigate('/stand', { replace: true })
              }
            } catch (e) {
              setCamError(e.message)
              setStatus('error')
            }
          },
          () => {} // frame-level decode errors are normal; ignore them
        )

        setStatus('scanning')
      } catch (e) {
        const msg = e?.message ?? String(e)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setCamError('Camera permission denied. Please allow camera access in your browser settings, then try again.')
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('no camera')) {
          setCamError('No camera found on this device.')
        } else {
          setCamError(msg || 'Could not start camera.')
        }
        setStatus('error')
      }
    }

    init()

    return () => {
      clearTimeout(transientTimer.current)
      if (qr) qr.stop().catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function goBack() {
    navigate(-1)
  }

  return (
    <div className="flex flex-col min-h-full bg-black">
      {/* Header */}
      <div className="bg-black text-white px-4 py-3 flex items-center gap-3 shrink-0 z-20">
        <button onClick={goBack} className="text-slate-300 py-2.5 px-2 -my-1.5 text-sm">
          ← Back
        </button>
        <span className="font-bold text-base flex-1 text-center">Scan Stand QR Code</span>
        <span className="w-16" />
      </div>

      {/* Camera area */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* html5-qrcode injects the video into this div */}
        <div
          id={READER_ID}
          className="w-full max-w-sm"
          style={{ minHeight: 300 }}
        />

        {/* Overlay states */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === 'resolving' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white font-medium">Looking up stand…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 gap-6">
            <div className="text-4xl">⚠️</div>
            <p className="text-white text-center text-sm leading-relaxed">{camError}</p>
            <button
              onClick={goBack}
              className="px-8 py-3 bg-white text-slate-800 rounded-xl font-semibold"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Transient "not a stand QR" message */}
        {transientMsg && status === 'scanning' && (
          <div className="absolute bottom-8 left-4 right-4 flex justify-center">
            <div className="bg-black/75 text-white px-4 py-2 rounded-full text-sm">
              {transientMsg}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {status === 'scanning' && (
        <div className="bg-black text-slate-400 text-center text-xs px-4 py-3 shrink-0">
          Point camera at the QR code on the stand
        </div>
      )}
    </div>
  )
}
