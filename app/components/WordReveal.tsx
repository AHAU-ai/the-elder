'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  text: string
  delayMs?: number
  wordDurationMs?: number
  onComplete?: () => void
}

export function WordReveal({ text, delayMs = 78, wordDurationMs = 650, onComplete }: Props) {
  const words = text.split(' ')
  const [count, setCount] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCount(0)
    let i = 0
    timer.current = setInterval(() => {
      i++
      setCount(i)
      if (i >= words.length) {
        clearInterval(timer.current!)
        onComplete?.()
      }
    }, delayMs)
    return () => { if (timer.current) clearInterval(timer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <>
      {words.map((word, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            marginRight: idx < words.length - 1 ? '0.28em' : undefined,
            opacity: idx < count ? 1 : 0,
            filter: idx < count ? 'blur(0px)' : 'blur(5px)',
            transform: idx < count ? 'translateY(0)' : 'translateY(3px)',
            transition: idx < count
              ? `opacity ${wordDurationMs}ms ease-out, filter ${wordDurationMs}ms ease-out, transform ${Math.round(wordDurationMs * 0.7)}ms ease-out`
              : 'none',
          }}
        >
          {word}
        </span>
      ))}
    </>
  )
}
