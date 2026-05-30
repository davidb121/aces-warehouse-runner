import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-full gap-4 px-6">
      <p className="text-slate-400 text-6xl font-bold">404</p>
      <p className="text-slate-600">Page not found</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold"
      >
        Go Home
      </button>
    </div>
  )
}
