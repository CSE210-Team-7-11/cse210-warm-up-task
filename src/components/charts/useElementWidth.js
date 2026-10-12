import { useEffect, useRef, useState } from 'react'

/** Track an element's content width so the SVG can size itself responsively. */
export default function useElementWidth(initial = 600) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, width]
}
