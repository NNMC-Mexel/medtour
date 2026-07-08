import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileText, ChevronLeft, RotateCcw, CreditCard, AlertCircle } from 'lucide-react'

const termsCopy = {
  en: {
    back: 'Back to home',
    title: 'Terms of Use',
    updated: 'Last updated: March 1, 2026',
    privacyLink: '<- Privacy Policy',
    sections: [
      {
        title: '1. General provisions',
        paragraphs: [
          'These Terms of Use govern access to the MedTour medical tourism platform, which helps patients arrange treatment in partner medical organizations in Kazakhstan.',
          'By registering on the platform or using its services, you confirm that you accept these Terms in full.',
        ],
      },
      {
        title: '2. Service description',
        paragraphs: ['The platform provides the following services:'],
        bullets: [
          'Online consultation: a secure video session with a doctor from a partner clinic for initial medical case review.',
          'Case communication: written messaging with the support team through the platform chat.',
          'Medical documents: upload, storage and transfer of documents for clinic review.',
        ],
        after: 'The cost of medical, service and logistics services is fixed in the treatment plan or commercial proposal.',
      },
      {
        title: '3. Service cost and payment',
        paragraphs: [
          'The consultation cost is shown in the doctor profile and booking modal before payment. The price is shown in tenge (₸) and includes applicable taxes.',
          'Accepted payment methods:',
        ],
        bullets: ['Bank card (Visa, Mastercard) with 3-D Secure support.', 'QR payment through the Halyk Home Bank app.'],
      },
      {
        title: '5. User obligations',
        bullets: [
          'Provide accurate health information.',
          'Do not use the platform in emergencies requiring ambulance assistance.',
          'Ensure a stable internet connection for video consultation.',
          'Do not record or distribute video sessions without the doctor’s consent.',
        ],
      },
      {
        title: '6. Platform liability',
        paragraphs: [
          'The platform is responsible for technical service availability and correct payment processing. Medical recommendations and conclusions are provided by doctors of the medical organization and remain the professional responsibility of the doctor and the medical organization.',
          'The platform is a technical tool for remote interaction and does not replace an in-person visit when the doctor determines that an in-person examination is needed.',
        ],
      },
      {
        title: '7. Dispute resolution',
        paragraphs: ['In case of a dispute, including disputes related to payment through Halyk Bank / ePay, the user may:'],
        bullets: [
          'Contact platform support: info@medtour.kz or +7 (7172) 123-456.',
          'Contact Halyk Bank through epay.homebank.kz.',
          'Apply to court at the Company’s location in Astana, Kazakhstan.',
        ],
      },
      {
        title: '8. Changes to the Terms',
        paragraphs: [
          'The Company may update these Terms. The current version is always available at medtour.nnmc.kz/terms. Continued use of the platform after publication of changes means that you accept them.',
        ],
      },
      {
        title: '9. Contact information',
        bullets: ['Company: NNMC Digital LLP', 'Address: Astana, Abylai Khan Ave., 42', 'Phone: +7 (7172) 123-456', 'Email: info@medtour.kz'],
      },
    ],
    paymentPartnerTitle: 'Payment partner: Halyk Bank of Kazakhstan',
    paymentPartnerText:
      'Online payments are processed through the secure ePay by Halyk payment gateway using 3-D Secure. Your card data is not transferred to or stored on platform servers.',
    refundTitle: '4. Cancellation and refund policy',
    refundColumns: ['Situation', 'Refund', 'Term'],
    refundRows: [
      ['Patient cancels more than 24 hours before the appointment', '100%', '3-5 business days'],
      ['Patient cancels less than 24 hours before the appointment', 'Not available', '-'],
      ['Doctor does not attend the consultation', '100%', '1-3 business days'],
      ['Technical failure caused by the platform', '100%', '1-3 business days'],
      ['Consultation was completed in full', 'Not available', '-'],
    ],
    refundRequestTitle: 'How to request a refund',
    refundRequestText:
      'Email info@medtour.kz or call +7 (7172) 123-456 with the appointment number and refund reason. Refunds are issued to the card used for payment.',
  },
  ru: {
    back: 'На главную',
    title: 'Условия использования',
    updated: 'Последнее обновление: 1 марта 2026 г.',
    privacyLink: '<- Политика конфиденциальности',
    sections: [
      {
        title: '1. Общие положения',
        paragraphs: [
          'Настоящие Условия использования регулируют порядок предоставления доступа к платформе медицинского туризма MedTour, которая помогает пациентам организовать лечение в партнерских медицинских организациях Казахстана.',
          'Регистрируясь на Платформе или используя её услуги, вы подтверждаете своё согласие с настоящими Условиями в полном объёме.',
        ],
      },
      {
        title: '2. Описание услуг',
        paragraphs: ['Платформа предоставляет следующие услуги:'],
        bullets: [
          'Онлайн-консультация: защищённый видеосеанс с врачом партнерской клиники для первичной оценки медицинского случая.',
          'Коммуникация по заявке: письменный обмен сообщениями с командой сопровождения через чат Платформы.',
          'Медицинские документы: загрузка, хранение и передача документов для рассмотрения клиникой.',
        ],
        after: 'Стоимость медицинских, сервисных и логистических услуг фиксируется в плане лечения или коммерческом предложении.',
      },
      {
        title: '3. Стоимость услуг и оплата',
        paragraphs: [
          'Стоимость консультации указывается в профиле врача и в модальном окне бронирования до момента оплаты. Цена указана в тенге (₸) и включает все применимые налоги.',
          'Принимаемые способы оплаты:',
        ],
        bullets: ['Банковская карта (Visa, Mastercard) с поддержкой 3-D Secure.', 'QR-оплата через приложение Halyk Home Bank.'],
      },
      {
        title: '5. Обязанности пользователя',
        bullets: [
          'Предоставлять достоверную информацию о состоянии здоровья.',
          'Не использовать платформу в экстренных ситуациях, требующих вызова скорой помощи.',
          'Обеспечить стабильное интернет-соединение для видеоконсультации.',
          'Не записывать и не распространять видеосеансы без согласия врача.',
        ],
      },
      {
        title: '6. Ответственность платформы',
        paragraphs: [
          'Платформа несёт ответственность за техническое обеспечение сервиса и корректную обработку платежей. Медицинские рекомендации и заключения предоставляются врачами медицинской организации и являются зоной профессиональной ответственности врача и медицинской организации.',
          'Платформа является техническим инструментом для дистанционного взаимодействия и не заменяет очного приёма у специалиста, если врач определил необходимость очного осмотра.',
        ],
      },
      {
        title: '7. Разрешение споров',
        paragraphs: ['В случае возникновения спора, в том числе связанного с оплатой через Halyk Bank / ePay, пользователь вправе:'],
        bullets: [
          'Обратиться в службу поддержки Платформы: info@medtour.kz или +7 (7172) 123-456.',
          'Обратиться в Halyk Bank через сайт epay.homebank.kz.',
          'Обратиться в суд по месту нахождения Компании (г. Астана, РК).',
        ],
      },
      {
        title: '8. Изменения условий',
        paragraphs: [
          'Компания оставляет за собой право обновлять настоящие Условия. Актуальная версия всегда доступна по адресу medtour.nnmc.kz/terms. Продолжение использования Платформы после публикации изменений означает ваше согласие с ними.',
        ],
      },
      {
        title: '9. Контактная информация',
        bullets: ['Компания: ТОО «ННМЦ Диджитал»', 'Адрес: г. Астана, просп. Абылай хана, 42', 'Телефон: +7 (7172) 123-456', 'Email: info@medtour.kz'],
      },
    ],
    paymentPartnerTitle: 'Платёжный партнёр — АО «Народный Банк Казахстана»',
    paymentPartnerText:
      'Онлайн-платежи обрабатываются через защищённый платёжный шлюз ePay by Halyk с применением технологии 3-D Secure. Данные вашей карты не передаются и не хранятся на серверах Платформы.',
    refundTitle: '4. Порядок отмены и возврата средств',
    refundColumns: ['Ситуация', 'Возврат', 'Срок'],
    refundRows: [
      ['Отмена пациентом более чем за 24 часа до приёма', '100%', '3-5 рабочих дней'],
      ['Отмена пациентом менее чем за 24 часа до приёма', 'Не предусмотрен', '-'],
      ['Врач не явился на консультацию', '100%', '1-3 рабочих дня'],
      ['Технический сбой по вине Платформы', '100%', '1-3 рабочих дня'],
      ['Консультация состоялась в полном объёме', 'Не предусмотрен', '-'],
    ],
    refundRequestTitle: 'Как запросить возврат',
    refundRequestText:
      'Напишите на info@medtour.kz или позвоните по номеру +7 (7172) 123-456, указав номер записи и причину возврата. Возврат осуществляется на карту, с которой была произведена оплата.',
  },
}

function Section({ title, paragraphs = [], bullets = [], after }) {
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
        {after && <p className="mt-2">{after}</p>}
      </div>
    </section>
  )
}

export default function TermsPage() {
  const { i18n } = useTranslation()
  const copy = termsCopy[i18n.language] || termsCopy.en

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
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{copy.updated}</p>
            </div>
          </div>

          {copy.sections.slice(0, 3).map((section) => (
            <Section key={section.title} {...section} />
          ))}

          <div className="mb-10 -mt-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">{copy.paymentPartnerTitle}</p>
              <p>
                {copy.paymentPartnerText}{' '}
                <a
                  href="https://epay.homebank.kz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-900 font-medium"
                >
                  epay.homebank.kz
                </a>
              </p>
            </div>
          </div>

          <section id="refund" className="mb-10">
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
              <RotateCcw className="w-5 h-5 text-teal-600" />
              <h2 className="text-xl font-semibold text-slate-900">{copy.refundTitle}</h2>
            </div>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {copy.refundColumns.map((column) => (
                        <th key={column} className="text-left px-4 py-3 font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {copy.refundRows.map((row, rowIndex) => (
                      <tr key={row[0]} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`px-4 py-3 ${cellIndex === 1 && cell === '100%' ? 'text-emerald-600 font-medium' : ''} ${cellIndex === 1 && cell !== '100%' ? 'text-rose-500 font-medium' : ''}`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">{copy.refundRequestTitle}</p>
                  <p>{copy.refundRequestText}</p>
                </div>
              </div>
            </div>
          </section>

          {copy.sections.slice(3).map((section) => (
            <Section key={section.title} {...section} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link to="/privacy" className="text-sm text-teal-600 hover:text-teal-700">
            {copy.privacyLink}
          </Link>
        </div>
      </div>
    </div>
  )
}
