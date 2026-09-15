import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/helpers'

function Reveal({ children, className, delay = 0, as: Component = 'div' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Component
      ref={ref}
      className={cn('landing-reveal', visible && 'is-visible', className)}
      style={{ '--reveal-delay': `${delay}ms` }}
    >
      {children}
    </Component>
  )
}

export default Reveal
