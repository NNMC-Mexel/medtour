import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plane } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { tourismPhotos } from '../../data/kazakhstanTourism'
import { cn } from '../../utils/helpers'

/**
 * Карточка места на странице «Туризм»: фото листаются стрелками, свайпом,
 * клавишами ← → и миниатюрами; ниже — описание из Admin > Туризм.
 * Родитель задаёт key={place.id}, чтобы другое место открывалось с первого фото.
 */
function TourismPlaceModal({ place, copy, typeLabel, onClose, onPlan }) {
  const photos = place ? tourismPhotos(place) : []
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)
  const count = photos.length
  const placeId = place?.id

  const show = (next) => setIndex(((next % count) + count) % count)

  useEffect(() => {
    if (!placeId || count < 2) return undefined
    const handleKey = (event) => {
      if (event.key === 'ArrowLeft') setIndex((current) => (current - 1 + count) % count)
      if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % count)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [placeId, count])

  if (!place) return null

  const paragraphs = String(place.details || '').split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean)

  return (
    <Modal
      isOpen
      onClose={onClose}
      size='xl'
      title={place.name}
      description={place.center ? `${copy.centerLabel}: ${place.center}` : undefined}
      footer={(
        <Button className='ml-auto' onClick={onPlan} leftIcon={<Plane className='h-4 w-4' />}>
          {copy.planCta}
        </Button>
      )}
    >
      {count > 0 && (
        <div className='-mx-4 -mt-4 sm:-mx-6 sm:-mt-6'>
          <div
            className='relative aspect-[16/10] overflow-hidden bg-slate-900'
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              const start = touchStartX.current
              touchStartX.current = null
              const end = event.changedTouches[0]?.clientX
              if (start === null || end === undefined || count < 2 || Math.abs(end - start) < 40) return
              show(index + (end < start ? 1 : -1))
            }}
          >
            <img
              key={photos[index]}
              src={photos[index]}
              alt={`${place.name} — ${index + 1}/${count}`}
              className='h-full w-full object-cover animate-fadeIn'
            />
            {count > 1 && (
              <>
                <button
                  type='button'
                  onClick={() => show(index - 1)}
                  aria-label={copy.prevPhoto}
                  className='absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-md backdrop-blur transition hover:bg-white'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <button
                  type='button'
                  onClick={() => show(index + 1)}
                  aria-label={copy.nextPhoto}
                  className='absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-md backdrop-blur transition hover:bg-white'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
                <span className='absolute bottom-3 right-3 rounded-full bg-slate-950/65 px-3 py-1 text-xs font-medium text-white'>
                  {index + 1} / {count}
                </span>
              </>
            )}
          </div>
          {count > 1 && (
            <div className='flex gap-2 overflow-x-auto px-4 py-3 sm:px-6'>
              {photos.map((url, photoIndex) => (
                <button
                  key={url}
                  type='button'
                  onClick={() => setIndex(photoIndex)}
                  aria-label={copy.showPhoto.replace('{n}', photoIndex + 1)}
                  aria-current={photoIndex === index}
                  className={cn(
                    'h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition',
                    photoIndex === index ? 'ring-teal-500' : 'ring-transparent opacity-70 hover:opacity-100',
                  )}
                >
                  <img src={url} alt='' loading='lazy' className='h-full w-full object-cover' />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={cn('space-y-5', count > 1 ? 'pt-2' : 'pt-5')}>
        {place.types?.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {place.types.map((type) => (
              <span key={type} className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'>
                {typeLabel(type)}
              </span>
            ))}
          </div>
        )}
        {place.summary && <p className='text-lg leading-8 text-slate-700'>{place.summary}</p>}
        {paragraphs.length > 0 && (
          <div>
            <h3 className='text-sm font-semibold text-slate-900'>{copy.aboutPlace}</h3>
            <div className='mt-2 space-y-3'>
              {paragraphs.map((text, paragraphIndex) => (
                <p key={paragraphIndex} className='whitespace-pre-line leading-7 text-slate-600'>{text}</p>
              ))}
            </div>
          </div>
        )}
        {place.highlights?.length > 0 && (
          <div className='border-t border-slate-100 pt-4'>
            <h3 className='text-sm font-semibold text-slate-900'>{copy.highlightsLabel}</h3>
            <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
              {place.highlights.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`} className='flex gap-2 text-sm leading-6 text-slate-600'>
                  <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500' />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default TourismPlaceModal
