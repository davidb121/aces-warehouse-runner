import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

// Subscribes to any change on the `requests` table and calls onRefresh.
// Uses a ref so the subscription is created once even as onRefresh identity changes.
export function useRealtimeQueue(onRefresh) {
  const callbackRef = useRef(onRefresh)

  useEffect(() => {
    callbackRef.current = onRefresh
  })

  useEffect(() => {
    const channel = supabase
      .channel('queue-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => callbackRef.current()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
