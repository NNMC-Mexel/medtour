import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ClipboardList, FileText, MessageCircle, User } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import PatientChatWidget from '../chat/PatientChatWidget'
import { PATIENT_BOTTOM_NAV_ITEMS } from '../../utils/constants'

const bottomIconMap = {
  activity: Activity,
  'message-circle': MessageCircle,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  user: User,
}

function DashboardLayout({ navItems }) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuthStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const sidebarTouchStartX = useRef(null)

  const path = location.pathname
  const title = t(`dashboard.page_titles.${path}`, t('dashboard.page_titles.default'))
  const subtitle = t(`dashboard.page_titles.${path}_sub`, '')

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

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
        <Sidebar navItems={navItems} onNavClick={closeMobileMenu} />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-[var(--app-height)] flex flex-col">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className={cn('flex-1 min-h-0 p-4 sm:p-6', user?.userRole === 'patient' && 'pb-24 sm:pb-6')}>
          <Outlet />
        </main>
      </div>
      {user?.userRole === 'patient' && location.pathname.startsWith('/patient') && (
        <>
          <div className="hidden sm:block">
            <PatientChatWidget />
          </div>
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-5">
              {PATIENT_BOTTOM_NAV_ITEMS.map((item) => {
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
