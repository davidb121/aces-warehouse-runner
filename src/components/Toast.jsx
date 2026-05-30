export default function Toast({ message }) {
  if (!message) return null
  return (
    <div
      key={message}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full text-sm z-50 shadow-lg whitespace-nowrap pointer-events-none animate-toast-in"
    >
      {message}
    </div>
  )
}
