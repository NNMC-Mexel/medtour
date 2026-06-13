import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Calendar, CreditCard, Shield, Bell, LogOut, Languages, Globe2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import CountrySelect from '../../components/ui/CountrySelect'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import useAuthStore from '../../stores/authStore'
import { formatDate, cn } from '../../utils/helpers'
import { normalizeCountryValue } from '../../utils/countries'

const getProfileFormData = (user) => ({
  fullName: user?.fullName || '',
  email: user?.email || '',
  phone: user?.phone || '',
  country: normalizeCountryValue(user?.country || ''),
  language: user?.language || 'en',
  timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  iin: user?.iin || '',
  birthDate: user?.birthDate || '',
  i18n: user?.i18n || {},
})

function PatientProfile() {
  const { t } = useTranslation()
  const { user, updateProfile, changePassword, logout } = useAuthStore()
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [transLang, setTransLang] = useState('kk')
  const [formData, setFormData] = useState(() => getProfileFormData(user))
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const visibleFormData = isEditing ? formData : getProfileFormData(user)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleI18nChange = (lang, value) => {
    setFormData((prev) => ({
      ...prev,
      i18n: { ...prev.i18n, [lang]: { ...(prev.i18n?.[lang] || {}), fullName: value } },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const result = await updateProfile(formData)
    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error || t('profile.save_error'))
      return
    }

    toast.success(t('profile.save_success'))
    setFormData(getProfileFormData(result.user || user))
    setIsEditing(false)
  }

  const handleEdit = () => {
    setFormData(getProfileFormData(user))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setFormData(getProfileFormData(user))
    setIsEditing(false)
  }

  const closePasswordModal = () => {
    if (isChangingPassword) return
    setIsPasswordModalOpen(false)
    setPasswordForm({ currentPassword: '', password: '', passwordConfirmation: '' })
    setPasswordErrors({})
  }

  const handlePasswordChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
    setPasswordErrors((prev) => ({ ...prev, [name]: undefined, submit: undefined }))
  }

  const validatePasswordForm = () => {
    const errors = {}
    if (!passwordForm.currentPassword) errors.currentPassword = t('profile.password_current_required')
    if (!passwordForm.password || passwordForm.password.length < 6) {
      errors.password = t('profile.password_min')
    }
    if (passwordForm.password && passwordForm.currentPassword === passwordForm.password) {
      errors.password = t('profile.password_same')
    }
    if (passwordForm.password !== passwordForm.passwordConfirmation) {
      errors.passwordConfirmation = t('profile.password_mismatch')
    }
    return errors
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    const errors = validatePasswordForm()
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsChangingPassword(true)
    const result = await changePassword(passwordForm)
    setIsChangingPassword(false)

    if (!result.success) {
      setPasswordErrors({ submit: result.error || t('profile.password_change_error') })
      return
    }

    toast.success(t('profile.password_changed'))
    closePasswordModal()
  }

  const profileFields = [
    { name: 'fullName', label: t('profile.full_name'), icon: User, type: 'text' },
    { name: 'email', label: t('profile.email'), icon: Mail, type: 'email', readOnly: true },
    { name: 'phone', label: t('profile.phone'), icon: Phone, type: 'tel' },
    { name: 'country', label: t('profile.country'), icon: Globe2, type: 'text' },
    { name: 'language', label: t('profile.language'), icon: Languages, type: 'text' },
    { name: 'timezone', label: t('profile.timezone'), icon: Globe2, type: 'text' },
    { name: 'iin', label: t('profile.iin'), icon: CreditCard, type: 'text', readOnly: true },
    { name: 'birthDate', label: t('profile.birth_date'), icon: Calendar, type: 'date' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Profile Header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <Avatar
              src={user?.avatar?.url}
              name={user?.fullName || user?.username}
              size="2xl"
            />
            <button className="absolute bottom-0 right-0 w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors">
              <User className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.fullName || user?.username}
            </h1>
            <p className="text-slate-600">{user?.email}</p>
            <p className="text-sm text-slate-500 mt-1">
              {t('profile.patient_since', { date: formatDate(user?.createdAt || new Date(), 'MMMM yyyy') })}
            </p>
          </div>
          <div className="sm:ml-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCancel}>
                  {t('profile.cancel')}
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  {t('profile.save')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleEdit}>
                {t('profile.edit')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personal_data')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {profileFields.map((field) => (
              field.name === 'country' ? (
                <CountrySelect
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  value={visibleFormData[field.name]}
                  onChange={handleChange}
                  disabled={!isEditing}
                  leftIcon={<field.icon className="w-4 h-4" />}
                />
              ) : (
                <Input
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  type={field.type}
                  value={visibleFormData[field.name]}
                  onChange={handleChange}
                  disabled={!isEditing || field.readOnly}
                  className={field.readOnly ? 'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed' : undefined}
                  leftIcon={<field.icon className="w-4 h-4" />}
                />
              )
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Name translations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-teal-600" />
            {t('profile.translations_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">{t('profile.translations_hint')}</p>

          {/* Language tabs */}
          <div className="flex gap-2">
            {[
              { code: 'kk', label: 'Қазақша' },
              { code: 'en', label: 'English' },
            ].map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setTransLang(code)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  transLang === code
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Input
            label={`${t('profile.full_name')} (${transLang === 'kk' ? 'Қазақша' : 'English'}) — ${t('profile.optional')}`}
            value={visibleFormData.i18n?.[transLang]?.fullName || ''}
            onChange={(e) => handleI18nChange(transLang, e.target.value)}
            disabled={!isEditing}
            placeholder={visibleFormData.fullName}
            leftIcon={<User className="w-4 h-4" />}
          />
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('profile.security')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              {t('profile.change_password')}
            </Button>
            {[
              t('profile.two_factor'),
              t('profile.active_sessions'),
            ].map((label) => (
              <button
                key={label}
                type="button"
                disabled
                className="w-full min-h-12 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed flex items-center justify-between gap-3 text-sm font-medium"
              >
                <span>{label}</span>
                <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-500">
                  {t('profile.in_development')}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('profile.notifications_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'email_notif', label: t('profile.email_notif') },
              { key: 'sms_notif', label: t('profile.sms_notif') },
              { key: 'appointment_reminders', label: t('profile.appointment_reminders') },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-700">{label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-rose-200">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">{t('profile.logout_title')}</h3>
              <p className="text-sm text-slate-500">{t('profile.logout_desc')}</p>
            </div>
            <Button
              variant="danger"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={logout}
            >
              {t('profile.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title={t('profile.password_modal_title')}
        description={t('profile.password_modal_desc')}
        size="sm"
        closeOnOverlay={!isChangingPassword}
        footer={
          <>
            <Button variant="secondary" onClick={closePasswordModal} disabled={isChangingPassword}>
              {t('profile.cancel')}
            </Button>
            <Button type="submit" form="change-password-form" isLoading={isChangingPassword}>
              {t('profile.password_save')}
            </Button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label={t('profile.password_current')}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
            error={passwordErrors.currentPassword}
          />
          <Input
            label={t('profile.password_new')}
            name="password"
            type="password"
            autoComplete="new-password"
            value={passwordForm.password}
            onChange={handlePasswordChange}
            error={passwordErrors.password}
            hint={t('profile.password_hint')}
          />
          <Input
            label={t('profile.password_confirm')}
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            value={passwordForm.passwordConfirmation}
            onChange={handlePasswordChange}
            error={passwordErrors.passwordConfirmation}
          />
          {passwordErrors.submit && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {passwordErrors.submit}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}

export default PatientProfile
