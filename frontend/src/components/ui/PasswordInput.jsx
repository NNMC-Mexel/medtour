import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import Input from './Input'

// Поле пароля с кнопкой «показать»: администратор, заводя аккаунт, видит, что
// именно он ввёл, и не создаёт пользователя с опечаткой в пароле.
const PasswordInput = forwardRef((props, ref) => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const label = visible ? t('auth.login.hide_password') : t('auth.login.show_password')
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      rightIcon={(
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className="-m-1.5 flex p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      )}
    />
  )
})

PasswordInput.displayName = 'PasswordInput'

export default PasswordInput
