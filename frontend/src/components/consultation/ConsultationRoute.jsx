import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import useConsultationStore from '../../stores/consultationStore'

function ConsultationRoute() {
  const { roomId } = useParams()
  const openConsultation = useConsultationStore((state) => state.openConsultation)

  useEffect(() => {
    openConsultation(roomId)
  }, [openConsultation, roomId])

  return <div className="min-h-[var(--app-height)] bg-slate-950" />
}

export default ConsultationRoute
