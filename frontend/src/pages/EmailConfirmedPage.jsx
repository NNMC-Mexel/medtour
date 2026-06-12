import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'

function EmailConfirmedPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              {t('auth_flow.confirmed_title')}
            </h1>
            <p className="text-slate-600 mb-6">
              {t('auth_flow.confirmed_desc')}
            </p>

            <Link to="/login" className="block">
              <Button className="w-full">
                {t('auth_flow.confirmed_login')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default EmailConfirmedPage
