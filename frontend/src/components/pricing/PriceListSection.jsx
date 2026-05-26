import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle, Loader2, ReceiptText, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { normalizeResponse, priceItemsAPI } from '../../services/api'
import { cn } from '../../utils/helpers'
import { formatPrice } from '../../utils/pricing'

function getLocalizedField(item, field, lang) {
  return item?.i18n?.[lang]?.[field] || item?.[field] || ''
}

function groupByCategory(items, lang) {
  return (items || []).reduce((acc, item) => {
    const category = getLocalizedField(item, 'category', lang) || 'Прайс'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {})
}

function PriceCard({ item, lang, compact = false }) {
  const title = getLocalizedField(item, 'title', lang)
  const description = getLocalizedField(item, 'description', lang)
  const unit = getLocalizedField(item, 'unit', lang)
  const badge = getLocalizedField(item, 'badge', lang)
  const note = getLocalizedField(item, 'note', lang)

  return (
    <Card className={cn('border-slate-200 shadow-sm h-full', item.isFeatured && 'border-teal-200 shadow-teal-100/60')}>
      <CardContent className={cn('flex h-full flex-col', compact ? 'p-4' : 'p-6')}>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            {badge && (
              <span className='inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700'>
                <Sparkles className='h-3.5 w-3.5' />
                {badge}
              </span>
            )}
            <h3 className={cn('font-semibold text-slate-900', compact ? 'mt-2 text-base' : 'mt-3 text-lg')}>
              {title}
            </h3>
          </div>
          <div className='text-right flex-shrink-0'>
            <div className={cn('font-bold text-slate-900', compact ? 'text-lg' : 'text-2xl')}>
              {formatPrice(item.price, item.currency)}
            </div>
            {unit && <div className='text-xs text-slate-500'>/ {unit}</div>}
          </div>
        </div>

        {description && <p className='mt-3 text-sm leading-6 text-slate-600'>{description}</p>}
        {note && (
          <div className='mt-4 flex items-start gap-2 text-xs text-slate-500'>
            <CheckCircle className='mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500' />
            <span>{note}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PriceListSection({
  compact = false,
  limit,
  featuredOnly = false,
  showCta = false,
  ctaTo = '/register',
  ctaLabel,
  ctaVariant,
  className,
}) {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadPrices = async () => {
      setIsLoading(true)
      try {
        const res = await priceItemsAPI.getAll({ featuredOnly })
        const { data } = normalizeResponse(res)
        if (isMounted) {
          setItems(data || [])
          setLoadFailed(false)
        }
      } catch (error) {
        console.error('Error loading price list:', error)
        if (isMounted) {
          setItems([])
          setLoadFailed(true)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadPrices()

    return () => {
      isMounted = false
    }
  }, [featuredOnly])

  const visibleItems = useMemo(() => {
    const source = loadFailed ? [] : items
    return [...source]
      .filter((item) => item.isActive !== false)
      .sort((a, b) => {
        const orderA = Number(a.sortOrder) || 0
        const orderB = Number(b.sortOrder) || 0
        if (orderA !== orderB) return orderA - orderB
        return (a.title || '').localeCompare(b.title || '', 'ru')
      })
      .slice(0, limit || undefined)
  }, [items, limit, loadFailed])

  const groupedItems = useMemo(
    () => groupByCategory(visibleItems, i18n.language),
    [visibleItems, i18n.language],
  )

  return (
    <section id={compact ? undefined : 'prices'} className={cn(compact ? 'space-y-4' : 'py-24 bg-slate-50', className)}>
      <div className={compact ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        <div className={compact ? 'flex items-start justify-between gap-4' : 'text-center mb-12'}>
          <div>
            <span className='inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-1 text-sm font-medium text-teal-700'>
              <ReceiptText className='h-4 w-4' />
              {t('pricing.badge')}
            </span>
            <h2 className={cn('font-bold text-slate-900', compact ? 'mt-3 text-xl' : 'mt-4 text-3xl sm:text-4xl')}>
              {compact ? t('pricing.patient_title') : t('pricing.title')}
            </h2>
            <p className={cn('text-slate-600', compact ? 'mt-1 text-sm' : 'mt-4 text-xl max-w-2xl mx-auto')}>
              {compact ? t('pricing.patient_subtitle') : t('pricing.subtitle')}
            </p>
          </div>
          {isLoading && compact && <Loader2 className='mt-2 h-5 w-5 animate-spin text-teal-600' />}
        </div>

        {isLoading && !compact ? (
          <div className='flex justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
          </div>
        ) : (
          <div className={cn('space-y-8', compact && 'space-y-5')}>
            {Object.entries(groupedItems).length === 0 ? (
              <div className='rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500'>
                {t('pricing.empty')}
              </div>
            ) : Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category}>
                <div className={cn('mb-4 flex items-center gap-3', compact && 'mb-3')}>
                  <h3 className={cn('font-semibold text-slate-900', compact ? 'text-base' : 'text-xl')}>
                    {category}
                  </h3>
                  <div className='h-px flex-1 bg-slate-200' />
                </div>
                <div className={cn('grid gap-4', compact ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3')}>
                  {categoryItems.map((item, index) => (
                    <PriceCard
                      key={item.documentId || item.id || `${item.title}-${index}`}
                      item={item}
                      lang={i18n.language}
                      compact={compact}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {showCta && (
          <div className='mt-10 flex justify-center'>
            <Link to={ctaTo}>
              <Button size='lg' variant={ctaVariant} rightIcon={<ArrowRight className='h-5 w-5' />}>
                {ctaLabel || t('pricing.cta')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default PriceListSection
