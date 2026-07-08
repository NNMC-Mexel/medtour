import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  UploadCloud,
  Video,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import useAuthStore from '../../stores/authStore'
import { useToast } from '../../components/ui/Toast'
import { getMediaUrl, guideVideosAPI, normalizeResponse } from '../../services/api'

const fallbackVideos = [
  {
    key: 'start',
    titleKey: 'start',
    icon: PlayCircle,
    src: '',
    poster: '',
  },
  {
    key: 'documents',
    titleKey: 'documents',
    icon: UploadCloud,
    src: '',
    poster: '',
  },
  {
    key: 'consultation',
    titleKey: 'consultation',
    icon: Video,
    src: '',
    poster: '',
  },
  {
    key: 'chat',
    titleKey: 'chat',
    icon: MessageCircle,
    src: '',
    poster: '',
  },
]

const iconMap = {
  play: PlayCircle,
  upload: UploadCloud,
  video: Video,
  chat: MessageCircle,
  document: FileText,
}

function getLanguageKey(language) {
  const normalized = String(language || 'en').toLowerCase()
  if (normalized.startsWith('ru')) return 'ru'
  if (normalized.startsWith('kk') || normalized.startsWith('kz')) return 'kk'
  return 'en'
}

function getLocalizedField(item, field, lang) {
  const language = getLanguageKey(lang)
  return item?.i18n?.[language]?.[field] || item?.[field] || ''
}

function getLocalizedMedia(item, field, lang) {
  const language = getLanguageKey(lang)
  return item?.i18n?.[language]?.[field] || null
}

function getGuideVideoSource(item, lang) {
  const language = getLanguageKey(lang)
  const locale = item?.i18n?.[language] || {}
  return locale.videoUrl || getMediaUrl(locale.videoFile) || item?.videoUrl || getMediaUrl(item?.videoFile) || ''
}

function getGuidePoster(item, lang) {
  return getMediaUrl(getLocalizedMedia(item, 'poster', lang)) || getMediaUrl(item?.poster) || ''
}

function PatientGuide() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { completePlatformGuide, isLoading } = useAuthStore()
  const [videos, setVideos] = useState(fallbackVideos)
  const [activeVideo, setActiveVideo] = useState(fallbackVideos[0].key)
  const [isVideosLoading, setIsVideosLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    const loadVideos = async () => {
      setIsVideosLoading(true)
      try {
        const res = await guideVideosAPI.getAll()
        const { data } = normalizeResponse(res)
        const mapped = (data || []).map((item) => ({
          key: item.documentId || item.id,
          title: getLocalizedField(item, 'title', i18n.language),
          description: getLocalizedField(item, 'description', i18n.language),
          icon: iconMap[item.icon] || PlayCircle,
          src: getGuideVideoSource(item, i18n.language),
          poster: getGuidePoster(item, i18n.language),
        }))

        if (!ignore && mapped.length > 0) {
          setVideos(mapped)
          setActiveVideo(mapped[0].key)
        }
      } catch (error) {
        console.error('Error loading guide videos:', error)
      } finally {
        if (!ignore) setIsVideosLoading(false)
      }
    }

    loadVideos()
    return () => {
      ignore = true
    }
  }, [i18n.language])

  const currentVideo = useMemo(
    () => videos.find((video) => video.key === activeVideo) || videos[0] || fallbackVideos[0],
    [activeVideo, videos]
  )
  const CurrentIcon = currentVideo.icon
  const currentTitle = currentVideo.title || t(`platform_guide.videos.${currentVideo.titleKey}.title`)

  const finishGuide = async () => {
    const result = await completePlatformGuide()
    if (result.success) {
      navigate('/patient', { replace: true })
      return
    }
    toast.error(result.error || t('platform_guide.error'))
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="bg-white border border-teal-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-0">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-medium mb-6">
              <ShieldCheck className="w-4 h-4" />
              {t('platform_guide.badge')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-normal">
              {t('platform_guide.title')}
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl">
              {t('platform_guide.subtitle')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={finishGuide}
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                {t('platform_guide.finish')}
              </Button>
            </div>
          </div>

          <div className="bg-slate-950 min-h-[280px] p-4 sm:p-6 flex items-center">
            {currentVideo.src ? (
              <video
                key={currentVideo.key}
                className="w-full aspect-video rounded-xl bg-black"
                src={currentVideo.src}
                poster={currentVideo.poster || undefined}
                controls
              />
            ) : (
              <div className="w-full aspect-video rounded-xl border border-white/10 bg-slate-900 flex flex-col items-center justify-center text-center px-6">
                {isVideosLoading ? (
                  <Loader2 className="w-6 h-6 text-teal-300 animate-spin" />
                ) : (
                  <CurrentIcon className="w-14 h-14 text-teal-300 mb-4" />
                )}
                <p className="text-white font-semibold mt-4">{currentTitle}</p>
                <p className="text-sm text-slate-400 mt-2 max-w-sm">
                  {t('platform_guide.video_pending')}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {videos.map((video) => {
          const Icon = video.icon
          const isActive = activeVideo === video.key
          const title = video.title || t(`platform_guide.videos.${video.titleKey}.title`)
          const description = video.description || t(`platform_guide.videos.${video.titleKey}.desc`)
          return (
            <button
              key={video.key}
              type="button"
              onClick={() => setActiveVideo(video.key)}
              className={`text-left bg-white border rounded-2xl p-5 shadow-sm transition-all ${
                isActive
                  ? 'border-teal-300 ring-2 ring-teal-100'
                  : 'border-slate-100 hover:border-teal-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                {isActive && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
              </div>
              <h3 className="font-semibold text-slate-900">
                {title}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                {description}
              </p>
            </button>
          )
        })}
      </section>

      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t('platform_guide.after_title')}</h3>
            <p className="text-slate-600 mt-1">{t('platform_guide.after_desc')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PatientGuide
