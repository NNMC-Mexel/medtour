import { Link, useLocation } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'

function VerifyEmailSentPage() {
  const location = useLocation()
  const email = location.state?.email
  const message = location.state?.message

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-teal-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Проверьте почту
            </h1>

            {email ? (
              <p className="text-slate-600 mb-2">
                Мы отправили письмо для подтверждения на адрес:
              </p>
            ) : null}

            {email ? (
              <p className="font-medium text-slate-900 mb-6 break-all">{email}</p>
            ) : null}

            {message ? (
              <p className="text-sm text-slate-600 mb-6">{message}</p>
            ) : (
              <p className="text-sm text-slate-600 mb-6">
                Перейдите по ссылке в письме, чтобы активировать аккаунт.
                После этого вы сможете войти.
              </p>
            )}

            <div className="space-y-3 text-left bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>Письмо может прийти в течение 1–2 минут</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>Проверьте папку «Спам», если письма нет во входящих</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span>Ссылка действительна ограниченное время</span>
              </div>
            </div>

            <div className="space-y-2">
              <Link to="/login" className="block">
                <Button variant="secondary" className="w-full">
                  Перейти ко входу
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
