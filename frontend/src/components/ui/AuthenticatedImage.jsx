import { useEffect, useState } from 'react'
import api, { getMediaUrl } from '../../services/api'

function AuthenticatedImage({ media, alt = '', className = '' }) {
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    let active = true
    let nextUrl = null
    const url = getMediaUrl(media)

    setObjectUrl(null)
    if (!url) return undefined

    api.get(url, { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        nextUrl = URL.createObjectURL(response.data)
        setObjectUrl(nextUrl)
      })
      .catch(() => {
        if (active) setObjectUrl(null)
      })

    return () => {
      active = false
      if (nextUrl) URL.revokeObjectURL(nextUrl)
    }
  }, [media?.url, media?.documentId, media?.id])

  if (!objectUrl) {
    return <div className={`bg-slate-200 ${className}`} aria-label={alt} />
  }

  return <img src={objectUrl} alt={alt} className={className} />
}

export default AuthenticatedImage
