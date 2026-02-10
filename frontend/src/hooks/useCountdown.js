import { useState, useEffect } from 'react'

export function useCountdown(deadlineAt) {
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, new Date(deadlineAt) - Date.now())
  })

  useEffect(() => {
    if (remaining <= 0) return

    const timer = setInterval(() => {
      const diff = Math.max(0, new Date(deadlineAt) - Date.now())
      setRemaining(diff)
      if (diff <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [deadlineAt])

  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  const isUrgent = remaining > 0 && remaining < 1800000 // < 30 min
  const isExpired = remaining <= 0

  return { hours, minutes, seconds, isUrgent, isExpired, remainingMs: remaining }
}
