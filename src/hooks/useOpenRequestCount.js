import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

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
    tag: 'open-requests',
  })
}

/**
 * Tracks open request count in realtime and fires a browser notification
 * when the count increases (new request arrived).
 *
 * Uses its own Supabase channel named 'queue-count-monitor' — a different
 * name from QueueView's 'queue-requests' channel — to avoid a conflict
 * that would silently break QueueView's subscription.
 */
export function useOpenRequestCount() {
  const [count, setCount] = useState(0)
  const prevRef = useRef(null)   // null = first load, skip notification
  const refreshRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const n = await fetchOpenCount()
      if (prevRef.current !== null && n > prevRef.current) {
        fireNotification(n)
      }
      prevRef.current = n
      setCount(n)
    } catch {
      // non-fatal — banner stays at last known count
    }
  }, [])

  // Keep ref current so the realtime callback always invokes the latest refresh
  useEffect(() => { refreshRef.current = refresh })

  // Initial fetch
  useEffect(() => { refresh() }, [refresh])

  // Own subscription — unique channel name avoids collision with QueueView
  useEffect(() => {
    const channel = supabase
      .channel('queue-count-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' },
        () => refreshRef.current?.())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return count
}
