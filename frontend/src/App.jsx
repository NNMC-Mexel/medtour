import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastProvider } from './components/ui/Toast'

// Layouts
import { PublicLayout, DashboardLayout } from './components/layout'

// Public Pages
import LandingPage from './pages/LandingPage'
import DoctorsPage from './pages/DoctorsPage'
import DoctorProfilePage from './pages/DoctorProfilePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailSentPage from './pages/VerifyEmailSentPage'
import EmailConfirmedPage from './pages/EmailConfirmedPage'
import TourismPage from './pages/TourismPage'
import PriceListPage from './pages/PriceListPage'

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard'
import PatientAppointments from './pages/patient/PatientAppointments'
import PatientProfile from './pages/patient/PatientProfile'
import PatientChat from './pages/patient/PatientChat'
import PatientDocuments from './pages/patient/PatientDocuments'
import PatientGuide from './pages/patient/PatientGuide'
import AppointmentDetail from './pages/AppointmentDetail'
import PatientPlanTrip from './pages/patient/PatientPlanTrip'

import MedicalCasesPage from './pages/cases/MedicalCasesPage'
import MedicalCaseDetail from './pages/cases/MedicalCaseDetail'

import NotificationsPage from './pages/NotificationsPage'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentFailure from './pages/PaymentFailure'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

// Stores
import useAuthStore from './stores/authStore'
import { initializeMobilePushNotifications } from './services/mobilePush'

// Utils
import { PATIENT_NAV_ITEMS, DOCTOR_NAV_ITEMS, ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS, COORDINATOR_NAV_ITEMS } from './utils/constants'

const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'))
const DoctorSchedule = lazy(() => import('./pages/doctor/DoctorSchedule'))
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients'))
const DoctorProfile = lazy(() => import('./pages/doctor/DoctorProfile'))
const PatientHistory = lazy(() => import('./pages/doctor/PatientHistory'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminDoctors = lazy(() => import('./pages/admin/AdminDoctors'))
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments'))
const AdminSpecializations = lazy(() => import('./pages/admin/AdminSpecializations'))
const AdminPriceList = lazy(() => import('./pages/admin/AdminPriceList'))
const AdminGuideVideos = lazy(() => import('./pages/admin/AdminGuideVideos'))
const AdminContent = lazy(() => import('./pages/admin/AdminContent'))
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'))
const VideoConsultation = lazy(() => import('./pages/VideoConsultation'))

// Loading component
function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">{t('common.loading')}</p>
      </div>
    </div>
  )
}

// Protected Route Component
function getRoleHomePath(userRole, user) {
  if (userRole === 'doctor') return '/doctor'
  if (userRole === 'admin') return '/admin'
  if (userRole === 'manager') return '/manager'
  if (userRole === 'coordinator') return '/coordinator'
  if (user?.platformGuideCompleted === false) return '/patient/guide'
  return '/patient'
}

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()
  const location = useLocation()
  
  // Ждём пока zustand загрузит данные из localStorage
  if (!_hasHydrated) {
    return <LoadingScreen />
  }
  
  // Получаем роль из userRole (так называется в Strapi)
  const userRole = user?.userRole || 'patient'

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to={getRoleHomePath(userRole, user)} replace />
  }

  if (userRole === 'patient') {
    const isGuidePath = location.pathname.startsWith('/patient/guide')

    if (user?.platformGuideCompleted === false && !isGuidePath) {
      return <Navigate to="/patient/guide" replace />
    }

  }

  return children
}

// Public Route (redirect if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()
  
  // Ждём пока zustand загрузит данные из localStorage
  if (!_hasHydrated) {
    return <LoadingScreen />
  }
  
  // Получаем роль из userRole (так называется в Strapi)
  const userRole = user?.userRole || 'patient'

  if (isAuthenticated) {
    return <Navigate to={getRoleHomePath(userRole, user)} replace />
  }

  return children
}

function ScrollRestoration() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1)
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      })
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.hash])

  return null
}

function App() {
  const { fetchUser, token, _hasHydrated } = useAuthStore()

  useEffect(() => {
    if (_hasHydrated && token) {
      fetchUser()
      initializeMobilePushNotifications()
    }
  }, [token, fetchUser, _hasHydrated])

  return (
    <ToastProvider>
    <BrowserRouter>
      <ScrollRestoration />
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:id" element={<DoctorProfilePage />} />
          <Route path="/specializations" element={<DoctorsPage />} />
          <Route path="/tourism" element={<TourismPage />} />
          <Route path="/prices" element={<PriceListPage />} />
          <Route path="/about" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Route>

        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email-sent" element={<VerifyEmailSentPage />} />
        <Route path="/email-confirmed" element={<EmailConfirmedPage />} />

        {/* Patient Routes */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <DashboardLayout navItems={PATIENT_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<PatientDashboard />} />
          <Route path="guide" element={<PatientGuide />} />
          <Route path="cases" element={<MedicalCasesPage />} />
          <Route path="cases/:id" element={<MedicalCaseDetail />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="doctors/:id" element={<DoctorProfilePage />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="documents" element={<PatientDocuments />} />
          <Route path="plan-trip" element={<PatientPlanTrip />} />
          <Route path="profile" element={<PatientProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Doctor Routes */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DashboardLayout navItems={DOCTOR_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<DoctorDashboard />} />
          <Route path="cases" element={<MedicalCasesPage />} />
          <Route path="cases/:id" element={<MedicalCaseDetail />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="patients/:patientId" element={<PatientHistory />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout navItems={ADMIN_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="specializations" element={<AdminSpecializations />} />
          <Route path="prices" element={<AdminPriceList />} />
          <Route path="guide-videos" element={<AdminGuideVideos />} />
          <Route path="settings" element={<AdminContent />} />
          <Route path="cases" element={<MedicalCasesPage />} />
          <Route path="cases/:id" element={<MedicalCaseDetail />} />
          <Route path="chat" element={<PatientChat />} />
        </Route>

        {/* Manager Routes */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <DashboardLayout navItems={MANAGER_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<StaffDashboard />} />
          <Route path="cases" element={<MedicalCasesPage />} />
          <Route path="cases/:id" element={<MedicalCaseDetail />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="documents" element={<PatientDocuments />} />
        </Route>

        {/* Coordinator Routes */}
        <Route
          path="/coordinator"
          element={
            <ProtectedRoute allowedRoles={['coordinator']}>
              <DashboardLayout navItems={COORDINATOR_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<StaffDashboard />} />
          <Route path="cases" element={<MedicalCasesPage />} />
          <Route path="cases/:id" element={<MedicalCaseDetail />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="doctors" element={<AdminDoctors readonly />} />
          <Route path="documents" element={<PatientDocuments />} />
        </Route>

        {/* Video Consultation */}
        <Route
          path="/consultation/:roomId"
          element={
            <ProtectedRoute>
              <VideoConsultation />
            </ProtectedRoute>
          }
        />

        {/* Payment Callbacks (ePay redirect) */}
        <Route
          path="/payment/success"
          element={
            <ProtectedRoute>
              <PaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route path="/payment/failure" element={<PaymentFailure />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  )
}

export default App
