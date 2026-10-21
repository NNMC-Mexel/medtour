import { useState, useEffect } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Filter,
  X,
  Loader2,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DoctorCard from '../components/doctors/DoctorCard'
import useAppointmentStore from '../stores/appointmentStore'
import { doctorMatchesSpec, getDoctorSpecNames, getSpecName, toDigits } from '../utils/helpers'
import { SHOW_DOCTOR_PRICES } from '../utils/constants'
import { useUsdRate } from '../hooks/useUsdRate'
import useSeo from '../components/seo/useSeo'

function DoctorsPage() {
  const usdRate = useUsdRate()
  const { t, i18n } = useTranslation()
  // /specializations показывает тот же каталог — canonical один.
  useSeo({ title: t('seo.doctors_title'), description: t('seo.doctors_description'), path: '/doctors' })

  const sortOptions = [
    { value: 'rating', label: t('doctors_page.sort_rating') },
    ...(SHOW_DOCTOR_PRICES ? [
      { value: 'price_asc', label: t('doctors_page.sort_price_asc') },
      { value: 'price_desc', label: t('doctors_page.sort_price_desc') },
    ] : []),
    { value: 'experience', label: t('doctors_page.sort_experience') },
  ]
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [selectedSpec, setSelectedSpec] = useState(searchParams.get('specialization') || '')
  const [sortBy, setSortBy] = useState('rating')
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [specSearch, setSpecSearch] = useState('')

  const { 
    doctors, 
    specializations, 
    isLoading, 
    fetchDoctors, 
    fetchSpecializations 
  } = useAppointmentStore()
  
  const location = useLocation()
  
  // Определяем базовый путь (для пациентов и публичных страниц)
  const basePath = location.pathname.startsWith('/patient') ? '/patient' : ''

  // Загружаем врачей и специализации
  useEffect(() => {
    fetchSpecializations()
    fetchDoctors()
  }, [fetchDoctors, fetchSpecializations])

  // Filter and sort doctors
  const filteredDoctors = doctors
    .filter((doc) => {
      const needle = searchQuery.toLowerCase()
      const matchesSearch =
        doc.fullName?.toLowerCase().includes(needle) ||
        Object.values(doc.i18n || {}).some((entry) => entry?.fullName?.toLowerCase().includes(needle)) ||
        getDoctorSpecNames(doc, i18n.language).some((name) => name.toLowerCase().includes(needle))
      const matchesSpec = !selectedSpec || doctorMatchesSpec(doc, selectedSpec)
      const matchesMinPrice = !SHOW_DOCTOR_PRICES || !priceRange.min || !usdRate || doc.price / usdRate >= Number(priceRange.min)
      const matchesMaxPrice = !SHOW_DOCTOR_PRICES || !priceRange.max || !usdRate || doc.price / usdRate <= Number(priceRange.max)
      return matchesSearch && matchesSpec && matchesMinPrice && matchesMaxPrice
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        case 'price_asc':
          return (a.price || 0) - (b.price || 0)
        case 'price_desc':
          return (b.price || 0) - (a.price || 0)
        case 'experience':
          return (b.experience || 0) - (a.experience || 0)
        default:
          return 0
      }
    })

  // Специальностей больше двух десятков, и список прокручивается внутри
  // фильтра. Поиск ищет по всем трём языкам названия, чтобы «кардио» находило
  // специальность независимо от текущей локали интерфейса.
  const specNeedle = specSearch.trim().toLowerCase()
  const visibleSpecializations = specNeedle
    ? specializations.filter((spec) =>
        [spec.name, spec.nameKk, spec.nameEn]
          .filter(Boolean)
          .some((name) => name.toLowerCase().includes(specNeedle))
      )
    : specializations

  const resetFilters = () => {
    setSelectedSpec('')
    setPriceRange({ min: '', max: '' })
    setSearchQuery('')
    setSpecSearch('')
  }

  const isInDashboard = basePath === '/patient'

  return (
    <div className={isInDashboard ? 'animate-fadeIn' : 'pt-28 pb-16 bg-slate-50 min-h-screen'}>
      <div className={isInDashboard ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('doctors_page.title')}</h1>
          <p className="text-slate-600">
            {t('doctors_page.subtitle', { count: filteredDoctors.length })}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className={`lg:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card className="sticky top-28">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-slate-900">{t('doctors_page.filter_title')}</h3>
                  <button
                    onClick={resetFilters}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    {t('doctors_page.reset_filters')}
                  </button>
                </div>

                {/* Specialization Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    {t('doctors_page.spec_label')}
                  </label>
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      aria-label={t('doctors_page.spec_search_placeholder')}
                      placeholder={t('doctors_page.spec_search_placeholder')}
                      value={specSearch}
                      onChange={(e) => setSpecSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {specSearch && (
                      <button
                        type="button"
                        onClick={() => setSpecSearch('')}
                        aria-label={t('common.clear_search')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="specialization"
                        checked={!selectedSpec}
                        onChange={() => setSelectedSpec('')}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-sm text-slate-700">{t('doctors_page.all_specs')}</span>
                    </label>
                    {visibleSpecializations.map((spec) => (
                      <label key={spec.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="specialization"
                          checked={selectedSpec === spec.name || selectedSpec === spec.id?.toString()}
                          onChange={() => setSelectedSpec(spec.name)}
                          className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-700">{getSpecName(spec, i18n.language)}</span>
                      </label>
                    ))}
                    {specNeedle && visibleSpecializations.length === 0 && (
                      <p className="py-2 text-sm text-slate-500">{t('doctors_page.spec_search_empty')}</p>
                    )}
                  </div>
                </div>

                {/* Price Filter */}
                {SHOW_DOCTOR_PRICES && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      {t('doctors_page.price_label')}
                    </label>
                    <div className="flex gap-3">
                      <Input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${t('doctors_page.price_label')}: ${t('doctors_page.price_from')}`}
                        placeholder={t('doctors_page.price_from')}
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: toDigits(e.target.value, 8) })}
                        className="text-sm"
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${t('doctors_page.price_label')}: ${t('doctors_page.price_to')}`}
                        placeholder={t('doctors_page.price_to')}
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: toDigits(e.target.value, 8) })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant="secondary"
                  className="w-full lg:hidden"
                  onClick={() => setShowFilters(false)}
                >
                  {t('doctors_page.apply_filters')}
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Sort Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('doctors_page.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="lg:hidden"
                  onClick={() => setShowFilters(!showFilters)}
                  leftIcon={<Filter className="w-4 h-4" />}
                >
                  {t('doctors_page.filter_title')}
                </Button>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedSpec || (SHOW_DOCTOR_PRICES && (priceRange.min || priceRange.max))) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedSpec && (
                  <Badge variant="primary" className="flex items-center gap-1">
                    {getSpecName(specializations.find(s => s.name === selectedSpec), i18n.language) || selectedSpec}
                    <button onClick={() => setSelectedSpec('')}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {SHOW_DOCTOR_PRICES && (priceRange.min || priceRange.max) && (
                  <Badge variant="primary" className="flex items-center gap-1">
                    {priceRange.min && t('doctors_page.price_from_badge', { price: priceRange.min })}
                    {priceRange.min && priceRange.max && ' — '}
                    {priceRange.max && t('doctors_page.price_to_badge', { price: priceRange.max })}
                    <button onClick={() => setPriceRange({ min: '', max: '' })}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {/* Doctors List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
              </div>
            ) : filteredDoctors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-slate-600 mb-4">
                    {t('doctors_page.no_results_text')}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={resetFilters}
                  >
                    {t('doctors_page.reset_button')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id || doctor.documentId}
                    doctor={doctor}
                    basePath={basePath}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorsPage
