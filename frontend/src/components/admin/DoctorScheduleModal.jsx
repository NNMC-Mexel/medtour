import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { useToast } from '../ui/Toast'
import AdminScheduleBuilder from './AdminScheduleBuilder'
import { doctorsAPI } from '../../services/api'
import { getDoctorScheduleConfig } from '../../utils/schedule'
import { buildSchedulePayload, saveWithScheduleConflictConfirm } from '../../utils/scheduleSave'

const SLOT_DURATIONS = [15, 30, 45, 60]

/**
 * Расписание одного врача: график, длительность приёма и отпуска.
 * Сохраняет только поля расписания (PUT /doctors/:id/schedule), поэтому
 * доступно врачу для своей карточки, менеджеру, координатору и админу.
 */
export default function DoctorScheduleModal({ doctor, isOpen, onClose, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [scheduleConfig, setScheduleConfig] = useState(() => getDoctorScheduleConfig(doctor || {}))
  const [slotDuration, setSlotDuration] = useState(String(doctor?.slotDuration || 30))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setScheduleConfig(getDoctorScheduleConfig(doctor || {}))
    setSlotDuration(String(doctor?.slotDuration || 30))
  }, [doctor, isOpen])

  const durationOptions = useMemo(
    () => SLOT_DURATIONS.map((minutes) => ({ value: String(minutes), label: t(`schedule.min_${minutes}`) })),
    [t],
  )

  const save = async () => {
    if (!doctor?.documentId) return
    const { payload, errorKey } = buildSchedulePayload(scheduleConfig, slotDuration)
    if (errorKey) {
      toast.error(t(errorKey))
      return
    }

    setIsSaving(true)
    try {
      const saved = await saveWithScheduleConflictConfirm(
        (data) => doctorsAPI.updateSchedule(doctor.documentId, data),
        payload,
        t,
      )
      if (!saved) return
      toast.success(t('schedule.save_success'))
      onSaved?.(payload)
      onClose()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('schedule.save_error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={doctor?.fullName ? `${t('admin_doc.schedule_title')} — ${doctor.fullName}` : t('admin_doc.schedule_title')}
      size='xl'
      footer={(
        <div className='ml-auto flex gap-3'>
          <Button variant='secondary' onClick={onClose} disabled={isSaving}>{t('common.cancel')}</Button>
          <Button onClick={save} isLoading={isSaving}>{t('common.save')}</Button>
        </div>
      )}
    >
      <div className='space-y-5'>
        <Select
          label={t('admin_doc.label_duration')}
          value={slotDuration}
          onChange={(event) => setSlotDuration(event.target.value)}
          options={durationOptions}
          containerClassName='max-w-xs'
        />
        <AdminScheduleBuilder value={scheduleConfig} onChange={setScheduleConfig} />
      </div>
    </Modal>
  )
}
