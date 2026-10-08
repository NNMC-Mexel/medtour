import { useTranslation } from 'react-i18next'
import PriceListSection from '../components/pricing/PriceListSection'
import useSeo from '../components/seo/useSeo'

function PriceListPage() {
  const { t } = useTranslation()
  useSeo({ title: t('seo.prices_title'), description: t('seo.prices_description'), path: '/prices' })
  return (
    <div className='bg-slate-50 pt-20'>
      <PriceListSection />
    </div>
  )
}

export default PriceListPage
