import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, KeyRound, Mail } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import PasswordInput from '../ui/PasswordInput'
import { useToast } from '../ui/Toast'
import api from '../../services/api'
import { getPasswordError } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'

const ERROR_KEYS = {
  user_blocked: 'admin_password.err_blocked',
  user_has_no_email: 'admin_password.err_no_email',
  email_send_failed: 'admin_password.err_email_failed',
}

/**
 * Пароль пользователя: письмо со ссылкой (пользователь сам задаёт пароль)
 * или новый пароль, который администратор вводит сам. Во втором случае
 * все сессии пользователя завершаются, а на почту уходит уведомление без
 * самого пароля — его администратор сообщает лично.
 */
function AdminPasswordModal({ user, currentUserId, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const changeOwnPassword = useAuthStore((state) => state.changePassword)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  const isSelf = Boolean(user) && user.id === currentUserId

  useEffect(() => {
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setSentTo('')
    setError('')
  }, [user])

  const errorText = (requestError) => {
    const message = requestError?.response?.data?.error?.message || ''
    if (ERROR_KEYS[message]) return t(ERROR_KEYS[message])
    // Политика паролей: сервер отвечает тем же ключом, что проверяет фронт.
    const i18nKey = requestError?.response?.data?.error?.details?.i18nKey
    if (i18nKey) return t(i18nKey, message)
    return t('admin_password.err_generic')
  }

  const sendResetLink = async () => {
    setIsSending(true)
    setError('')
    try {
      const response = await api.post(`/api/users/${user.id}/password-reset`)
      setSentTo(response?.data?.email || user.email)
      toast.success(t('admin_password.link_sent_toast'))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setIsSending(false)
    }
  }

  const setNewPassword = async (event) => {
    event.preventDefault()
    const policyError = getPasswordError(password)
    if (policyError) {
      setError(t(policyError))
      return
    }
    if (password !== confirmPassword) {
      setError(t('admin_users.err_password_mismatch'))
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const response = await api.put(`/api/users/${user.id}/password`, { password })
      toast.success(response?.data?.notified
        ? t('admin_password.set_toast_notified')
        : t('admin_password.set_toast'))
      onClose()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  // Свой пароль — с вводом текущего, тем же запросом, что в профиле пациента
  // (у админа отдельного профиля нет). Сервер выдаст новый токен, остальные
  // сессии админа завершатся.
  const setOwnPassword = async (event) => {
    event.preventDefault()
    if (!currentPassword) {
      setError(t('profile.password_current_required'))
      return
    }
    const policyError = getPasswordError(password)
    if (policyError) {
      setError(t(policyError))
      return
    }
    if (password === currentPassword) {
      setError(t('profile.password_same'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('admin_users.err_password_mismatch'))
      return
    }
    setIsSaving(true)
    setError('')
    const result = await changeOwnPassword({ currentPassword, password, passwordConfirmation: confirmPassword })
    setIsSaving(false)
    if (!result.success) {
      setError(/current password is invalid/i.test(result.error || '')
        ? t('admin_password.err_current_invalid')
        : t('admin_password.err_generic'))
      return
    }
    toast.success(t('profile.password_changed'))
    onClose()
  }

  const name = user?.fullName || user?.username || user?.email || ''

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={onClose}
      title={t('admin_password.title', { name })}
      size="md"
    >
      <div className="space-y-6">
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50">
              <Mail className="h-5 w-5 text-teal-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">{t('admin_password.link_title')}</h3>
              <p className="mt-0.5 text-sm text-slate-500 break-words">
                {t('admin_password.link_desc', { email: user?.email || '—' })}
              </p>
            </div>
          </div>
          {sentTo ? (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{t('admin_password.link_sent', { email: sentTo })}</span>
            </p>
          ) : (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={sendResetLink}
              isLoading={isSending}
              disabled={!user?.email || user?.blocked}
              leftIcon={<Mail className="h-4 w-4" />}
            >
              {t('admin_password.link_btn')}
            </Button>
          )}
          {user?.blocked && <p className="text-xs text-slate-500">{t('admin_password.err_blocked')}</p>}
        </section>

        <div className="border-t border-slate-100" />

        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">{t(isSelf ? 'admin_password.self_title' : 'admin_password.set_title')}</h3>
              {!isSelf && <p className="mt-0.5 text-sm text-slate-500">{t('admin_password.set_desc')}</p>}
            </div>
          </div>
          {isSelf ? (
            <form onSubmit={setOwnPassword} className="space-y-3">
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{t('admin_password.self_desc')}</p>
              <PasswordInput
                label={t('profile.password_current')}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <PasswordInput
                label={t('admin_password.label_new')}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={t('password_policy.hint')}
              />
              <PasswordInput
                label={t('admin_password.label_confirm')}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button type="submit" className="w-full sm:w-auto" isLoading={isSaving} leftIcon={<KeyRound className="h-4 w-4" />}>
                {t('admin_password.set_btn')}
              </Button>
            </form>
          ) : (
            <form onSubmit={setNewPassword} className="space-y-3">
              <PasswordInput
                label={t('admin_password.label_new')}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={t('password_policy.hint')}
              />
              <PasswordInput
                label={t('admin_password.label_confirm')}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button type="submit" className="w-full sm:w-auto" isLoading={isSaving} leftIcon={<KeyRound className="h-4 w-4" />}>
                {t('admin_password.set_btn')}
              </Button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  )
}

export default AdminPasswordModal
