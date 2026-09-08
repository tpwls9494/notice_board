import { useEffect, useState } from 'react'
import { blogAPI } from '../services/api'

export default function useBlogActivity(ids) {
  const key = ids.join(',')
  const [state, setState] = useState({ key: '', data: {}, stale: false })
  useEffect(() => {
    if (!key) return
    let active = true
    let busy = false
    const controller = new AbortController()
    async function refresh() {
      if (document.hidden || busy) return
      busy = true
      try {
        const { data } = await blogAPI.getActivity(key.split(',').map(Number), controller.signal)
        if (active) setState({ key, data: Object.fromEntries(data.map((item) => [item.post_id, item])), stale: false })
      } catch {
        if (active) setState((current) => ({ key, data: current.key === key ? current.data : {}, stale: true }))
      } finally { busy = false }
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('blog-activity-changed', refresh)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('blog-activity-changed', refresh)
    }
  }, [key])
  return state.key === key ? state : { data: {}, stale: false }
}
