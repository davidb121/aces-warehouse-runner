import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRealtimeQueue } from './useRealtimeQueue'

async function fetchOpenCount() {
  const { count, error } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  if (error) throw error
  return count ?? 0
}

function fireNotification(count) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(`${count} restock request${count !== 1 ? 's' : ''} waiting`, {
    body: 'Open the queue to accept a request.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: 'open-requests', // replaces any previous notification with this tag
  })
}

/**
 * Tracks the number of open requests in realtime.
 * Fires a browser notification whenever the count increases (new request arrived).
 * prevRef is null on first load so we don't notify on initial render.
 */
export function useOpenRequestCount() {
  const [count, setCount] = useState(0)
  const prevRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const n = await fetchOpenCount()
      if (prevRef.current !== null && n > prevRef.current) {
        fireNotification(n)
      }
      prevRef.current = n
      setCount(n)
    } catch {
      // non-fatal — banner just stays at last known count
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useRealtimeQueue(refresh)

  return count
}
