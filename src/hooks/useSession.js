import { useState } from 'react'

const SESSION_KEY = 'wh_runner_session'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    const s = JSON.parse(raw)
    // Expire stand/runner selections at end of day; keep role
    if (s.day && s.day !== todayStr()) {
      return { role: s.role }
    }
    return s
  } catch {
    return {}
  }
}

export function useSession() {
  const [session, setSessionState] = useState(loadSession)

  function setSession(updates) {
    // Write to localStorage inside the updater so it's always in sync,
    // even if the component navigates away immediately after calling setSession.
    setSessionState(prev => {
      const next = { ...prev, ...updates, day: todayStr() }
      // Null out falsy values rather than storing them
      Object.keys(next).forEach(k => {
        if (next[k] === null || next[k] === undefined) delete next[k]
      })
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY)
    setSessionState({})
  }

  return { session, setSession, clearSession }
}
