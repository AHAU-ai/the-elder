'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  text: string
  delayMs?: number
  wordDurationMs?: number
  carved?: boolean
  onComplete?: () => void
}

export function WordReveal({ text, delayMs = 78, wordDurationMs = 650, carved = false, onComplete }: Props) {
  const words = text.split(' ')
  const [count, setCount] = useState(0)
  // Cancellation token — increments on every new text prop,
  // orphaned timer callbacks check it before setting state.
  const tokenRef = useRef(0)

  useEffect(() => {
    setCount(0)
    const token = ++tokenRef.current

    if (!carved) {
      let i = 0
      const interval = setInterval(() => {
        if (tokenRef.current !== token) { clearInterval(interval); return }
        i++
        setCount(i)
        if (i >= words.length) { clearInterval(interval); onComplete?.() }
      }, delayMs)
      return () => clearInterval(interval)
    } else {
      let i = 0
      let cancelled = false
      const scheduleNext = () => {
        if (cancelled || tokenRef.current !== token) return
        if (i >= words.length) { onComplete?.(); return }
        const word = words[i]
        const isPunct     = /[,;:—]/.test(word)
        const isSentEnd   = /[.!?]$/.test(word)
        const jitter      = (Math.random() - 0.4) * 18
        const delay       = delayMs + jitter + (isPunct ? 80 : 0) + (isSentEnd ? 220 : 0)
        setTimeout(() => {
          if (cancelled || tokenRef.current !== token) return
          i++
          setCount(i)
          scheduleNext()
        }, delay)
      }
      scheduleNext()
      return () => { cancelled = true }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, carved])

  return (
    <>
      {words.map((word, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            marginRight: idx < words.length - 1 ? '0.28em' : undefined,
            opacity: idx < count ? 1 : 0,
            filter: idx < count ? 'blur(0px)' : 'blur(4px)',
            transform: idx < count ? 'translateY(0)' : 'translateY(2px)',
            transition: idx < count
              ? `opacity ${carved ? wordDurationMs * 1.3 : wordDurationMs}ms ease-out,
                 filter ${carved ? wordDurationMs * 1.2 : wordDurationMs}ms ease-out,
                 transform ${Math.round((carved ? wordDurationMs * 1.1 : wordDurationMs) * 0.7)}ms ease-out`
              : 'none',
          }}
        >
          {word}
        </span>
      ))}
    </>
  )
}
