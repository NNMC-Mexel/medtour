import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle,
  FileText,
  UserCheck,
  Stethoscope,
  ClipboardList,
  Plane,
  ArrowRight,
  ChevronRight,
  Upload,
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

// Each step maps to a stage in the 18-state machine the patient will go through.
const steps = [
  {
    icon: CheckCircle,
    color: 'bg-teal-500',
    titleKey: 'onboarding.step1_title',
    descKey: 'onboarding.step1_desc',
    actionKey: null,
  },
  {
    icon: FileText,
    color: 'bg-sky-500',
    titleKey: 'onboarding.step2_title',
    descKey: 'onboarding.step2_desc',
    actionKey: 'onboarding.step2_action',
  },
  {
    icon: UserCheck,
    color: 'bg-violet-500',
    titleKey: 'onboarding.step3_title',
    descKey: 'onboarding.step3_desc',
    actionKey: null,
  },
  {
    icon: Stethoscope,
    color: 'bg-amber-500',
    titleKey: 'onboarding.step4_title',
    descKey: 'onboarding.step4_desc',
    actionKey: null,
  },
  {
    icon: ClipboardList,
    color: 'bg-orange-500',
    titleKey: 'onboarding.step5_title',
    descKey: 'onboarding.step5_desc',
    actionKey: null,
  },
  {
    icon: Plane,
    color: 'bg-emerald-500',
    titleKey: 'onboarding.step6_title',
    descKey: 'onboarding.step6_desc',
    actionKey: null,
  },
]

export default function CaseCreatedGuide({ isOpen, onClose, caseId, caseNumber }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)

  const isLast = activeStep === steps.length - 1
  const step = steps[activeStep]
  const Icon = step.icon

  const handleNext = () => {
    if (isLast) {
      onClose()
      if (caseId) navigate(`/patient/cases/${caseId}`)
    } else {
      setActiveStep((s) => s + 1)
    }
  }

  const handleUploadNow = () => {
    onClose()
    if (caseId) navigate(`/patient/cases/${caseId}`)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showClose={false}
      closeOnOverlay={false}
    >
      <div className="flex flex-col items-center text-center">
        {/* Success badge */}
        <div className="mb-6 w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-teal-500" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-1">
          {t('onboarding.title')}
        </h2>
        {caseNumber && (
          <p className="text-sm text-slate-500 mb-6">
            {t('onboarding.case_number', { num: caseNumber })}
          </p>
        )}

        {/* Step progress dots */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`rounded-full transition-all ${
                i === activeStep
                  ? 'w-6 h-2 bg-teal-500'
                  : i < activeStep
                  ? 'w-2 h-2 bg-teal-300'
                  : 'w-2 h-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="w-full bg-slate-50 rounded-2xl p-6 mb-6 text-left">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {t('onboarding.step_label', { num: activeStep + 1, total: steps.length })}
              </p>
              <h3 className="font-semibold text-slate-900 mb-2">
                {t(step.titleKey)}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(step.descKey)}
              </p>
              {step.actionKey && (
                <button
                  onClick={handleUploadNow}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  <Upload className="w-4 h-4" />
                  {t(step.actionKey)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Timeline preview (collapsed) */}
        <div className="w-full mb-6">
          <p className="text-xs text-slate-400 mb-3">{t('onboarding.full_path')}</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {steps.map((s, i) => {
              const StepIcon = s.icon
              return (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                      i === activeStep
                        ? s.color + ' shadow-md scale-110'
                        : i < activeStep
                        ? 'bg-teal-100'
                        : 'bg-slate-100'
                    }`}
                    onClick={() => setActiveStep(i)}
                    title={t(s.titleKey)}
                  >
                    <StepIcon
                      className={`w-4 h-4 ${
                        i === activeStep ? 'text-white' : i < activeStep ? 'text-teal-500' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            {t('onboarding.skip')}
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1"
            rightIcon={isLast ? undefined : <ArrowRight className="w-4 h-4" />}
          >
            {isLast ? t('onboarding.open_case') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
