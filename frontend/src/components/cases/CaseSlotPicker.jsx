import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format, addDays, isSameDay } from 'date-fns'
import { ru, kk, enUS } from 'date-fns/locale'
import { Calendar, Calendar as CalIcon, Check, Clock, CreditCard, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { cn } from '../../utils/helpers'
import { appointmentsAPI, getBookedSlots } from '../../services/api'
import { useToast } from '../ui/Toast'

// Free consultations are the current production default. Set
// VITE_FREE_CONSULTATIONS=false only when paid consultations are re-enabled.
const FREE_CONSULTATIONS = import.meta.env.VITE_FREE_CONSULTATIONS !== 'false'

const generateTimeSlots = (doctor) => {
  const workStart = doctor?.workStartTime || '09:00'
  const workEnd = doctor?.workEndTime || '18:00'
  const slotDuration = doctor?.slotDuration || 30
  const breakStart = doctor?.breakStart || '12:00'
  const breakEnd = doctor?.breakEnd || '14:00'

  const slots = []
  const [sh, sm] = workStart.split(':').map(Number)
  const [eh, em] = workEnd.split(':').map(Number)
  const [bsh, bsm] = breakStart.split(':').map(Number)
  const [beh, bem] = breakEnd.split(':').map(Number)

  let h = sh, m = sm
  while (h < eh || (h === eh && m < em)) {
    const total = h * 60 + m
    const inBreak = total >= bsh * 60 + bsm && total < beh * 60 + bem
    if (!inBreak) slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += slotDuration
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
  }
  return slots
}

const filterPastSlots = (slots, date) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sel = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (sel > today) return slots
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30
  return slots.filter(t => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m > nowMins
  })
}

// role: 'patient' | 'manager' | 'coordinator' | 'admin' | ...
export default function CaseSlotPicker({ isOpen, onClose, doctor, caseDocId, patientId, role = 'patient', onBooked }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const dateLocale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru

  const isStaff = ['manager', 'coordinator', 'admin'].includes(role)

  const [step, setStep] = useState(1) // 1 = date/time, 2 = payment (patient only, non-free)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [bookedSlots, setBookedSlots] = useState([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))

  const getWorkingDays = () => {
    if (!doctor?.workingDays) return [1, 2, 3, 4, 5]
    if (typeof doctor.workingDays === 'string')
      return doctor.workingDays.split(',').map(Number).filter(n => !isNaN(n))
    return doctor.workingDays
  }

  const workingDays = getWorkingDays()
  const isWorkingDay = (date) => {
    const iso = date.getDay() === 0 ? 7 : date.getDay()
    return workingDays.includes(iso)
  }

  useEffect(() => {
    if (!isOpen) {
      setSelectedDate(null)
      setSelectedTime(null)
      setBookedSlots([])
      setStep(1)
    }
  }, [isOpen])

  useEffect(() => {
    if (!selectedDate || !doctor?.id) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    setIsLoadingSlots(true)
    setBookedSlots([])
    getBookedSlots(doctor.id, dateStr)
      .then(slots => setBookedSlots(slots || []))
      .catch(() => setBookedSlots([]))
      .finally(() => setIsLoadingSlots(false))
  }, [selectedDate, doctor?.id])

  const allSlots = selectedDate ? generateTimeSlots(doctor) : []
  const available = filterPastSlots(
    allSlots.filter(t => !bookedSlots.includes(t)),
    selectedDate || new Date()
  )

  const buildDateTime = () => {
    if (!selectedDate || !selectedTime) return null
    const [h, m] = selectedTime.split(':').map(Number)
    const dt = new Date(selectedDate)
    dt.setHours(h, m, 0, 0)
    return dt
  }

  // Staff books → pending/pending appointment, no case status change
  const bookForStaff = async () => {
    const dateTime = buildDateTime()
    if (!dateTime) return
    setIsSaving(true)
    try {
      await appointmentsAPI.create({
        patient: patientId,
        doctor: doctor.id,
        dateTime: dateTime.toISOString(),
        type: 'video',
        status: 'pending',
        paymentStatus: 'pending',
        medical_case: caseDocId,
        roomId: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })
      toast.success(t('case_slot.staff_booked'))
      onBooked?.()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('case_slot.error'))
    } finally {
      setIsSaving(false)
    }
  }

  // Patient pays (test) or books free → confirmed/paid appointment.
  // Case status (CONSULTATION_BOOKED) is set server-side by the appointment controller.
  const payAndBook = async () => {
    const dateTime = buildDateTime()
    if (!dateTime) return
    setIsSaving(true)
    try {
      await appointmentsAPI.create({
        patient: patientId,
        doctor: doctor.id,
        dateTime: dateTime.toISOString(),
        type: 'video',
        status: 'confirmed',
        paymentStatus: 'paid',
        price: 0,
        medical_case: caseDocId,
        roomId: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })
      toast.success(t('case_slot.booked_success'))
      onBooked?.()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('case_slot.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = () => {
    if (isStaff || FREE_CONSULTATIONS) {
      // Staff books directly; free mode patients also skip payment
      isStaff ? bookForStaff() : payAndBook()
    } else {
      setStep(2)
    }
  }

  const summaryText = selectedDate && selectedTime
    ? t('case_slot.selected_summary', {
        date: format(selectedDate, 'd MMMM yyyy', { locale: dateLocale }),
        time: selectedTime,
      })
    : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? t('case_slot.title') : t('case_slot.payment_title')}
      size="md"
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleNext}
              disabled={!selectedDate || !selectedTime || isSaving}
              leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            >
              {isStaff
                ? t('case_slot.staff_confirm_btn')
                : FREE_CONSULTATIONS
                ? t('booking.book_free')
                : t('case_slot.next_btn')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={isSaving}>
              {t('common.back')}
            </Button>
            <Button
              onClick={payAndBook}
              disabled={isSaving}
              leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            >
              {t('case_slot.pay_test_btn')}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-6">
          {doctor && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{doctor.fullName}</p>
                <p className="text-xs text-slate-500">{t('case_slot.doctor_label')}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              <Calendar className="inline w-4 h-4 mr-1 text-slate-400" />
              {t('booking.select_date')}
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map(date => {
                const isSelected = selectedDate && isSameDay(date, selectedDate)
                const isWorking = isWorkingDay(date)
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => { if (isWorking) { setSelectedDate(date); setSelectedTime(null) } }}
                    disabled={!isWorking}
                    className={cn(
                      'shrink-0 w-16 py-3 rounded-xl text-center transition-all',
                      isSelected ? 'bg-teal-600 text-white' :
                      !isWorking ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                      'bg-white border border-slate-200 hover:border-teal-500'
                    )}
                  >
                    <div className="text-xs opacity-70">{format(date, 'EEE', { locale: dateLocale })}</div>
                    <div className="text-lg font-semibold">{format(date, 'd')}</div>
                    <div className="text-xs opacity-70">{format(date, 'MMM', { locale: dateLocale })}</div>
                    {!isWorking && <div className="text-[10px] text-slate-400">{t('booking.day_off')}</div>}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDate && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                <Clock className="inline w-4 h-4 mr-1 text-slate-400" />
                {t('booking.select_time')}
              </label>
              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                  {t('booking.loading_slots')}
                </div>
              ) : available.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-500">{t('booking.no_slots_date')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {available.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={cn(
                        'py-2 px-1 rounded-lg text-xs font-medium transition-all',
                        selectedTime === time
                          ? 'bg-teal-600 text-white'
                          : 'bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50'
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {summaryText && (
            <div className="p-3 bg-teal-50 rounded-xl text-sm text-teal-800 font-medium">
              {summaryText}
            </div>
          )}
        </div>
      ) : (
        // Step 2: Test payment
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <CalIcon className="w-4 h-4 text-teal-500" />
              {summaryText}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              {t('case_slot.doctor_label')}: {doctor?.fullName}
            </div>
          </div>

          <div className="p-4 border-2 border-teal-500 rounded-xl bg-teal-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{t('case_slot.test_payment_label')}</p>
                <p className="text-xs text-slate-500">{t('case_slot.test_payment_desc')}</p>
              </div>
              <Check className="w-5 h-5 text-teal-600 ml-auto" />
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">{t('case_slot.test_payment_notice')}</p>
        </div>
      )}
    </Modal>
  )
}
