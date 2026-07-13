import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import useConsultationStore from '../../stores/consultationStore'

const VideoConsultation = lazy(() => import('../../pages/VideoConsultation'))

function getRoleHomePath(user) {
  const userRole = user?.userRole || 'patient'
  if (userRole === 'doctor') return '/doctor'
  if (userRole === 'admin') return '/admin'
  if (userRole === 'manager') return '/manager'
  if (userRole === 'coordinator') return '/coordinator'
  if (user?.platformGuideCompleted === false) return '/patient/guide'
  return '/patient'
}

function ActiveConsultation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const {
    activeRoomId,
    isMinimized,
    minimizeConsultation,
    restoreConsultation,
    closeConsultation,
  } = useConsultationStore()
  const lastWorkspacePathRef = useRef(null)

  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const isConsultationPath = location.pathname.startsWith('/consultation/')

  useEffect(() => {
    if (!isConsultationPath) {
      lastWorkspacePathRef.current = currentPath
    }
  }, [currentPath, isConsultationPath])

  if (!activeRoomId) return null

  const getFallbackPath = () => lastWorkspacePathRef.current || getRoleHomePath(user)

  const handleMinimize = () => {
    minimizeConsultation()
    if (isConsultationPath) {
      navigate(getFallbackPath(), { replace: true })
    }
  }

  const handleRestore = () => {
    restoreConsultation()
    navigate(`/consultation/${encodeURIComponent(activeRoomId)}`)
  }

  const handleClose = () => {
    closeConsultation()
    if (isConsultationPath) {
      navigate(getFallbackPath(), { replace: true })
    }
  }

  return (
    <Suspense fallback={null}>
      <VideoConsultation
        roomId={activeRoomId}
        isMinimized={isMinimized}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        onClose={handleClose}
      />
    </Suspense>
  )
}

export default ActiveConsultation
