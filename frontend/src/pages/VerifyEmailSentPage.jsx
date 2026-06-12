import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { authAPI } from '../services/api'

function VerifyEmailSentPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const email = location.state?.email
  const emailDelivered = location.state?.emailDelivered !== false
  const message = location.state?.message
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState(null)
  const [resendCooldown, setResendCooldown] = useState(email ? 60 : 0)
  const cooldownRef = useRef(null)

  useEffect(() => {
    if (!resendCooldown) return undefined

    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(cooldownRef.current)
  }, [])

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return

    setIsSending(true)
    setSendStatus(null)

    try {
      await authAPI.sendEmailConfirmation(email)
      setSendStatus({ type: 'success', text: t('auth_flow.verify_resend_success') })
      setResendCooldown(60)
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      const rawMessage = err.response?.data?.error?.message || ''
      const text = rawMessage.toLowerCase().includes('already confirmed')
        ? t('auth_flow.verify_already_confirmed')
        : t('auth_flow.verify_resend_error')
      setSendStatus({ type: 'error', text })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth_flow.verify_home')}
        </Link>

        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-teal-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              {t('auth_flow.verify_title')}
            </h1>

            {email ? (
              <p className="text-slate-600 mb-2">
                {emailDelivered ? t('auth_flow.verify_sent_to') : t('auth_flow.verify_not_sent_to')}
              </p>
            ) : null}

            {email ? (
              <p className="font-medium text-slate-900 mb-6 break-all">{email}</p>
            ) : null}

            {message ? (
              <p className="text-sm text-slate-600 mb-6">{message}</p>
            ) : (
              <p className="text-sm text-slate-600 mb-6">
                {t('auth_flow.verify_instruction')}
              </p>
            )}

            <div className="space-y-3 text-left bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>{t('auth_flow.verify_tip_wait')}</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>{t('auth_flow.verify_tip_spam')}</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>{t('auth_flow.verify_tip_link')}</span>
              </div>
            </div>

            {sendStatus ? (
              <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 text-left ${
                sendStatus.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{sendStatus.text}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              {email ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  isLoading={isSending}
                >
                  {resendCooldown > 0
                    ? t('auth_flow.verify_resend_cooldown', { seconds: resendCooldown })
                    : t('auth_flow.verify_resend')}
                </Button>
              ) : null}
              <Link to="/login" className="block">
                <Button variant="secondary" className="w-full">
                  {t('auth_flow.verify_login')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default VerifyEmailSentPage
