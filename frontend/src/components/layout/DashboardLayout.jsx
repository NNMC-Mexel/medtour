import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ClipboardList, FileText, MessageCircle, User } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import PatientChatWidget from '../chat/PatientChatWidget'
import { PATIENT_BOTTOM_NAV_ITEMS } from '../../utils/constants'
import { medicalCasesAPI, normalizeResponse } from '../../services/api'
import { normalizeCaseStatus } from '../../utils/medicalCaseWorkflow'

const bottomIconMap = {
  activity: Activity,
  'message-circle': MessageCircle,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  user: User,
}

const ALWAYS_AVAILABLE_PATIENT_PATHS = new Set([
  '/patient',
  '/patient/cases',
  '/patient/guide',
  '/patient/profile',
])

const CONSULTATION_AVAILABLE_STATUSES = new Set([
  'DOCTOR_ASSIGNED',
  'WAITING_PATIENT_CONFIRMATION',
  'WAITING_PAYMENT',
  'CONSULTATION_BOOKED',
  'CONSULTATION_COMPLETED',
  'LOCAL_TREATMENT',
  'TREATMENT_IN_KAZAKHSTAN',
  'TRAVEL_PREPARATION',
  'ARRIVED_TO_KAZAKHSTAN',
  'IN_TREATMENT',
  'RECOVERY',
  'COMPLETED',
])

const PLAN_TRIP_AVAILABLE_STATUSES = new Set([
  'WAITING_PATIENT_CONFIRMATION',
  'WAITING_PAYMENT',
  'CONSULTATION_COMPLETED',
  'LOCAL_TREATMENT',
  'TREATMENT_IN_KAZAKHSTAN',
  'TRAVEL_PREPARATION',
  'ARRIVED_TO_KAZAKHSTAN',
  'IN_TREATMENT',
  'RECOVERY',
  'COMPLETED',
])

function getPatientNavAccess(cases) {
  const items = Array.isArray(cases) ? cases : []
  const hasCase = items.length > 0
  const hasConsultationAccess = items.some((item) => (
    Boolean(item.doctor) || CONSULTATION_AVAILABLE_STATUSES.has(normalizeCaseStatus(item.status))
  ))
  const hasPlanTripAccess = items.some((item) => PLAN_TRIP_AVAILABLE_STATUSES.has(normalizeCaseStatus(item.status)))

  return {
    hasCase,
    hasConsultationAccess,
    hasPlanTripAccess,
  }
}

function isPatientNavItemAvailable(item, access) {
  return isPatientPathAvailable(item.path, access)
}

function isPatientPathAvailable(path, access) {
  if (!access) return true
  if (path.startsWith('/patient/cases/')) return true
  if (ALWAYS_AVAILABLE_PATIENT_PATHS.has(path)) return true
  if (path.startsWith('/patient/chat')) return access.hasCase
  if (path.startsWith('/patient/documents')) return access.hasCase
  if (path.startsWith('/patient/appointments')) return access.hasConsultationAccess
  if (path.startsWith('/patient/doctors')) return access.hasConsultationAccess
  if (path.startsWith('/patient/plan-trip')) return access.hasPlanTripAccess
  return true
}

function DashboardLayout({ navItems }) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuthStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [patientCases, setPatientCases] = useState(null)
  const [patientNavReady, setPatientNavReady] = useState(false)
  const [patientNavFailed, setPatientNavFailed] = useState(false)
  const sidebarTouchStartX = useRef(null)

  const path = location.pathname
  const title = t(`dashboard.page_titles.${path}`, t('dashboard.page_titles.default'))
  const subtitle = t(`dashboard.page_titles.${path}_sub`, '')
  const isPatientArea = user?.userRole === 'patient' && location.pathname.startsWith('/patient')

  const loadPatientCases = useCallback(async () => {
    if (!isPatientArea || !user?.id) return
    setPatientNavReady(false)
    setPatientNavFailed(false)
    try {
      const response = await medicalCasesAPI.getAll()
      const { data } = normalizeResponse(response)
      setPatientCases(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading patient navigation state:', error)
      setPatientNavFailed(true)
    } finally {
      setPatientNavReady(true)
    }
  }, [isPatientArea, user?.id])

  useEffect(() => {
    if (!isPatientArea || !user?.id) {
      setPatientCases(null)
      setPatientNavReady(false)
      setPatientNavFailed(false)
      return undefined
    }

    loadPatientCases()
    window.addEventListener('medtour:cases-changed', loadPatientCases)
    return () => window.removeEventListener('medtour:cases-changed', loadPatientCases)
  }, [isPatientArea, loadPatientCases, user?.id])

  const patientAccess = useMemo(() => (
    isPatientArea && patientNavReady && !patientNavFailed
      ? getPatientNavAccess(patientCases)
      : null
  ), [isPatientArea, patientCases, patientNavFailed, patientNavReady])

  const effectiveNavItems = useMemo(() => {
    if (!isPatientArea) return navItems
    return navItems.filter((item) => isPatientNavItemAvailable(item, patientAccess))
  }, [isPatientArea, navItems, patientAccess])

  const effectiveBottomNavItems = useMemo(() => {
    if (!isPatientArea) return PATIENT_BOTTOM_NAV_ITEMS
    return PATIENT_BOTTOM_NAV_ITEMS.filter((item) => isPatientNavItemAvailable(item, patientAccess))
  }, [isPatientArea, patientAccess])

  const isCurrentPatientPathUnavailable = useMemo(() => {
    if (!isPatientArea || !patientAccess) return false
    return !isPatientPathAvailable(path, patientAccess)
  }, [isPatientArea, path, patientAccess])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  if (isCurrentPatientPathUnavailable) {
    return <Navigate to="/patient/cases" replace />
  }

  return (
    <div className="min-h-[var(--app-height)] bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/30">
      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity duration-300',
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileMenu}
      />
      <div
        className={cn(
          'fixed left-0 top-0 h-[var(--app-height)] z-50 transition-transform duration-300 lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        onTouchStart={(e) => { sidebarTouchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (sidebarTouchStartX.current === null) return
          const diff = sidebarTouchStartX.current - e.changedTouches[0].clientX
          if (diff > 60) closeMobileMenu()
          sidebarTouchStartX.current = null
        }}
      >
        <Sidebar navItems={effectiveNavItems} onNavClick={closeMobileMenu} />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 min-w-0 min-h-[var(--app-height)] flex flex-col">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className={cn('flex-1 min-w-0 min-h-0 overflow-x-hidden p-4 sm:p-6', user?.userRole === 'patient' && 'pb-24 sm:pb-6')}>
          <Outlet />
        </main>
      </div>
      {isPatientArea && (
        <>
          <div className="hidden sm:block">
            <PatientChatWidget />
          </div>
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden pb-[env(safe-area-inset-bottom)]">
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${Math.max(effectiveBottomNavItems.length, 1)}, minmax(0, 1fr))` }}
            >
              {effectiveBottomNavItems.map((item) => {
                const Icon = bottomIconMap[item.icon] || Activity
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/patient'}
                    className={({ isActive }) => cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
                      isActive ? 'text-teal-700' : 'text-slate-500'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="max-w-full truncate">{t(item.label)}</span>
                  </NavLink>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

export default DashboardLayout
