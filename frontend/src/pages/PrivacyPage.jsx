import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Shield, ChevronLeft } from 'lucide-react'

const privacyCopy = {
  en: {
    back: 'Back to home',
    title: 'Privacy Policy',
    updated: 'Last updated: March 1, 2026',
    nextLink: 'Terms of Use and Refund Policy ->',
    sections: [
      {
        title: '1. General provisions',
        paragraphs: [
          'This Privacy Policy explains how MedTour (the “Company”, “we”) collects, uses and protects personal data of users of the MedTour platform (medtour.nnmc.kz).',
          'By using the service, you agree to this Policy. If you do not agree, please stop using the service.',
        ],
      },
      {
        title: '2. Data collection and use',
        paragraphs: ['We collect the following categories of data:'],
        bullets: [
          'Registration data: name, surname, email, phone number and date of birth for account creation and identification.',
          'Medical data: information you provide to the doctor during a consultation, shared only with the treating doctor and processed with medical confidentiality.',
          'Payment data: we do not store bank card details. Payments are processed through the certified payment gateway of Halyk Bank / ePay.',
          'Technical data: IP address, browser type and cookies needed to keep the service working.',
        ],
      },
      {
        title: '3. Disclosure to third parties',
        paragraphs: ['We do not sell or transfer your personal data to third parties except for:'],
        bullets: [
          'Platform doctors, only for medical information required to provide the service.',
          'Halyk Bank / ePay, for name, email and phone number during payment processing.',
          'Government authorities when required by law.',
        ],
      },
      {
        title: '4. Data security',
        paragraphs: [
          'We use technical and organizational measures to protect your data, including HTTPS/TLS encryption, password hashing and restricted database access. Payment transactions use 3-D Secure.',
        ],
      },
      {
        title: '5. Cookies',
        paragraphs: [
          'The site uses cookies for authorization and service analytics. You can disable cookies in your browser settings, but some features may become unavailable.',
        ],
      },
      {
        title: '6. Data retention and deletion',
        paragraphs: [
          'Data is stored while your account is active and for 3 years after deletion in accordance with Kazakhstan law. Upon written request to info@medtour.kz, we will delete your account and related data within 30 days unless retention is required by law.',
        ],
      },
      {
        title: '7. User rights',
        paragraphs: ['You have the right to:'],
        bullets: [
          'Request access to your personal data.',
          'Request correction of inaccurate data.',
          'Withdraw consent to data processing.',
          'File a complaint with the authorized personal data protection authority of Kazakhstan.',
        ],
      },
      {
        title: '8. Policy changes',
        paragraphs: [
          'We may update this Policy. In case of material changes, users will be notified by email or through their account.',
        ],
      },
      {
        title: '9. Contacts',
        paragraphs: ['For personal data questions, contact us:'],
        bullets: ['Email: info@medtour.kz', 'Phone: +7 (7172) 123-456', 'Address: Astana, Abylai Khan Ave., 42'],
      },
    ],
  },
  ru: {
    back: 'На главную',
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 1 марта 2026 г.',
    nextLink: 'Условия использования и политика возврата ->',
    sections: [
      {
        title: '1. Общие положения',
        paragraphs: [
          'Настоящая Политика конфиденциальности описывает, как MedTour (далее — «Компания», «мы») собирает, использует и защищает персональные данные пользователей платформы MedTour (medtour.nnmc.kz).',
          'Используя сервис, вы соглашаетесь с условиями данной Политики. Если вы не согласны — пожалуйста, прекратите использование сервиса.',
        ],
      },
      {
        title: '2. Сбор и использование данных',
        paragraphs: ['Мы собираем следующие категории данных:'],
        bullets: [
          'Регистрационные данные: имя, фамилия, email, телефон, дата рождения — для создания и идентификации учётной записи.',
          'Медицинские данные: информация, которую вы предоставляете врачу в ходе консультации, передаётся исключительно лечащему врачу и обрабатывается с соблюдением врачебной тайны.',
          'Платёжные данные: мы не храним реквизиты банковских карт. Платежи обрабатываются через сертифицированный платёжный шлюз Halyk Bank / ePay.',
          'Технические данные: IP-адрес, тип браузера, cookie-файлы — для обеспечения работоспособности сервиса.',
        ],
      },
      {
        title: '3. Передача данных третьим лицам',
        paragraphs: ['Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением:'],
        bullets: [
          'Врачей платформы — в части медицинской информации, необходимой для оказания услуги.',
          'Halyk Bank / ePay — имя, email, телефон при проведении оплаты через платёжный шлюз.',
          'Государственных органов — по законному требованию.',
        ],
      },
      {
        title: '4. Защита данных',
        paragraphs: [
          'Для защиты ваших данных применяются технические и организационные меры: шифрование HTTPS/TLS, хэширование паролей, ограничение доступа к базе данных. Платёжные транзакции обрабатываются по технологии 3-D Secure.',
        ],
      },
      {
        title: '5. Cookie-файлы',
        paragraphs: [
          'Сайт использует cookie для корректной работы авторизации и аналитики. Вы можете отключить cookie в настройках браузера, однако некоторые функции сервиса могут стать недоступны.',
        ],
      },
      {
        title: '6. Хранение и удаление данных',
        paragraphs: [
          'Данные хранятся в течение срока действия вашей учётной записи и 3 лет после её удаления в соответствии с требованиями законодательства РК. По письменному запросу на info@medtour.kz мы удалим вашу учётную запись и связанные с ней данные в течение 30 дней, если это не противоречит требованиям закона.',
        ],
      },
      {
        title: '7. Права пользователя',
        paragraphs: ['Вы вправе:'],
        bullets: [
          'Запросить доступ к своим персональным данным.',
          'Потребовать исправления неточных данных.',
          'Отозвать согласие на обработку данных.',
          'Обратиться с жалобой в уполномоченный орган по защите персональных данных РК.',
        ],
      },
      {
        title: '8. Изменения Политики',
        paragraphs: [
          'Мы оставляем за собой право вносить изменения в настоящую Политику. При существенных изменениях пользователи будут уведомлены по email или через уведомление в личном кабинете.',
        ],
      },
      {
        title: '9. Контакты',
        paragraphs: ['По вопросам обработки персональных данных обращайтесь:'],
        bullets: ['Email: info@medtour.kz', 'Телефон: +7 (7172) 123-456', 'Адрес: г. Астана, просп. Абылай хана, 42'],
      },
    ],
  },
}

function Section({ title, paragraphs = [], bullets = [] }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="space-y-3 text-slate-600 leading-relaxed">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {bullets.length > 0 && (
          <ul className="list-disc pl-6 space-y-1.5">
            {bullets.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  const { i18n } = useTranslation()
  const copy = privacyCopy[i18n.language] || privacyCopy.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          {copy.back}
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{copy.updated}</p>
            </div>
          </div>

          {copy.sections.map((section) => (
            <Section key={section.title} {...section} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link to="/terms" className="text-sm text-teal-600 hover:text-teal-700">
            {copy.nextLink}
          </Link>
        </div>
      </div>
    </div>
  )
}
