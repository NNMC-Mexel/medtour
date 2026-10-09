// Тексты правовых документов по умолчанию. Админ может заменить разделы
// в Admin > Контент сайта > Правовые документы.

export const privacyCopy = {
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

export const termsCopy = {
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
          'Consultation estimates are shown in USD before payment. The payment provider shows the final charge and settlement currency before confirmation.',
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
          'Ориентировочная стоимость консультации показывается в долларах США до оплаты. Платёжный провайдер показывает итоговую сумму и валюту списания перед подтверждением.',
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

// Казахские версии — перевод русского текста. Юридически значимой остаётся
// русская редакция; перевод стоит вычитать юристу.
privacyCopy.kk = {
  back: 'Басты бетке',
  title: 'Құпиялылық саясаты',
  updated: 'Соңғы жаңарту: 2026 жылғы 1 наурыз',
  nextLink: 'Пайдалану шарттары және қаражатты қайтару саясаты ->',
  sections: [
    {
      title: '1. Жалпы ережелер',
      paragraphs: [
        'Осы Құпиялылық саясаты MedTour (бұдан әрі — «Компания», «біз») MedTour платформасы (medtour.nnmc.kz) пайдаланушыларының дербес деректерін қалай жинайтынын, пайдаланатынын және қорғайтынын сипаттайды.',
        'Сервисті пайдалана отырып, сіз осы Саясаттың шарттарымен келісесіз. Егер келіспесеңіз, сервисті пайдалануды тоқтатыңыз.',
      ],
    },
    {
      title: '2. Деректерді жинау және пайдалану',
      paragraphs: ['Біз деректердің мына санаттарын жинаймыз:'],
      bullets: [
        'Тіркеу деректері: аты, тегі, email, телефон, туған күні — есептік жазбаны жасау және сәйкестендіру үшін.',
        'Медициналық деректер: кеңес барысында дәрігерге беретін ақпаратыңыз тек емдеуші дәрігерге беріледі және дәрігерлік құпияны сақтай отырып өңделеді.',
        'Төлем деректері: біз банк карталарының деректемелерін сақтамаймыз. Төлемдер Halyk Bank / ePay сертификатталған төлем шлюзі арқылы өңделеді.',
        'Техникалық деректер: IP-мекенжай, браузер түрі, cookie-файлдар — сервистің жұмысын қамтамасыз ету үшін.',
      ],
    },
    {
      title: '3. Деректерді үшінші тұлғаларға беру',
      paragraphs: ['Біз сіздің дербес деректеріңізді үшінші тұлғаларға сатпаймыз және бермейміз, мыналарды қоспағанда:'],
      bullets: [
        'Платформа дәрігерлері — қызмет көрсетуге қажетті медициналық ақпарат бөлігінде.',
        'Halyk Bank / ePay — төлем шлюзі арқылы төлеу кезінде аты, email, телефон.',
        'Мемлекеттік органдар — заңды талап бойынша.',
      ],
    },
    {
      title: '4. Деректерді қорғау',
      paragraphs: [
        'Деректеріңізді қорғау үшін техникалық және ұйымдастырушылық шаралар қолданылады: HTTPS/TLS шифрлау, құпиясөздерді хэштеу, дерекқорға қолжетімділікті шектеу. Төлем транзакциялары 3-D Secure технологиясы бойынша өңделеді.',
      ],
    },
    {
      title: '5. Cookie-файлдар',
      paragraphs: [
        'Сайт авторизация мен аналитиканың дұрыс жұмыс істеуі үшін cookie пайдаланады. Cookie-ді браузер баптауларында өшіруге болады, бірақ сервистің кейбір функциялары қолжетімсіз болуы мүмкін.',
      ],
    },
    {
      title: '6. Деректерді сақтау және жою',
      paragraphs: [
        'Деректер ҚР заңнамасының талаптарына сәйкес есептік жазбаңыздың әрекет ету мерзімі ішінде және ол жойылғаннан кейін 3 жыл бойы сақталады. info@medtour.kz мекенжайына жазбаша сұрау бойынша, егер бұл заң талаптарына қайшы келмесе, есептік жазбаңыз бен оған байланысты деректерді 30 күн ішінде жоямыз.',
      ],
    },
    {
      title: '7. Пайдаланушы құқықтары',
      paragraphs: ['Сіз құқылысыз:'],
      bullets: [
        'Өз дербес деректеріңізге қол жеткізуді сұрауға.',
        'Дұрыс емес деректерді түзетуді талап етуге.',
        'Деректерді өңдеуге берілген келісімді кері қайтарып алуға.',
        'ҚР дербес деректерді қорғау жөніндегі уәкілетті органына шағыммен жүгінуге.',
      ],
    },
    {
      title: '8. Саясатқа өзгерістер',
      paragraphs: [
        'Біз осы Саясатқа өзгерістер енгізу құқығын өзімізде қалдырамыз. Елеулі өзгерістер болған жағдайда пайдаланушылар email арқылы немесе жеке кабинеттегі хабарлама арқылы хабардар етіледі.',
      ],
    },
    {
      title: '9. Байланыс',
      paragraphs: ['Дербес деректерді өңдеу мәселелері бойынша хабарласыңыз:'],
      bullets: [
        'Email: info@medtour.kz',
        'Телефон: +7 (7172) 123-456',
        'Мекенжай: Астана қ., Абылай хан даңғылы, 42',
      ],
    },
  ],
}

termsCopy.kk = {
  back: 'Басты бетке',
  title: 'Пайдалану шарттары',
  updated: 'Соңғы жаңарту: 2026 жылғы 1 наурыз',
  privacyLink: '<- Құпиялылық саясаты',
  sections: [
    {
      title: '1. Жалпы ережелер',
      paragraphs: [
        'Осы Пайдалану шарттары пациенттерге Қазақстанның серіктес медициналық ұйымдарында емделуді ұйымдастыруға көмектесетін MedTour медициналық туризм платформасына қол жеткізу тәртібін реттейді.',
        'Платформада тіркелу немесе оның қызметтерін пайдалану арқылы сіз осы Шарттармен толық көлемде келісетініңізді растайсыз.',
      ],
    },
    {
      title: '2. Қызметтер сипаттамасы',
      paragraphs: ['Платформа мына қызметтерді ұсынады:'],
      bullets: [
        'Онлайн-кеңес: медициналық жағдайды алғашқы бағалау үшін серіктес клиника дәрігерімен қорғалған бейнесеанс.',
        'Өтінім бойынша байланыс: Платформа чаты арқылы сүйемелдеу командасымен жазбаша хабар алмасу.',
        'Медициналық құжаттар: клиниканың қарауы үшін құжаттарды жүктеу, сақтау және беру.',
      ],
      after: 'Медициналық, сервистік және логистикалық қызметтердің құны емдеу жоспарында немесе коммерциялық ұсыныста бекітіледі.',
    },
    {
      title: '3. Қызметтер құны және төлем',
      paragraphs: [
        'Кеңестің шамамен құны төлемге дейін АҚШ долларымен көрсетіледі. Төлем провайдері растау алдында түпкілікті соманы және есептен шығару валютасын көрсетеді.',
        'Қабылданатын төлем тәсілдері:',
      ],
      bullets: [
        '3-D Secure қолдайтын банк картасы (Visa, Mastercard).',
        'Halyk Home Bank қосымшасы арқылы QR-төлем.',
      ],
    },
    {
      title: '5. Пайдаланушының міндеттері',
      bullets: [
        'Денсаулық жағдайы туралы шынайы ақпарат беру.',
        'Жедел жәрдем шақыруды талап ететін шұғыл жағдайларда платформаны пайдаланбау.',
        'Бейнекеңес үшін тұрақты интернет байланысын қамтамасыз ету.',
        'Дәрігердің келісімінсіз бейнесеанстарды жазбау және таратпау.',
      ],
    },
    {
      title: '6. Платформаның жауапкершілігі',
      paragraphs: [
        'Платформа сервисті техникалық қамтамасыз етуге және төлемдерді дұрыс өңдеуге жауапты. Медициналық ұсынымдар мен қорытындыларды медициналық ұйымның дәрігерлері береді және олар дәрігер мен медициналық ұйымның кәсіби жауапкершілігі аймағына жатады.',
        'Платформа қашықтан өзара әрекеттесуге арналған техникалық құрал болып табылады және дәрігер бетпе-бет тексеру қажеттігін анықтаса, маманның бетпе-бет қабылдауын алмастырмайды.',
      ],
    },
    {
      title: '7. Дауларды шешу',
      paragraphs: ['Дау туындаған жағдайда, соның ішінде Halyk Bank / ePay арқылы төлеуге байланысты, пайдаланушы құқылы:'],
      bullets: [
        'Платформаның қолдау қызметіне жүгінуге: info@medtour.kz немесе +7 (7172) 123-456.',
        'epay.homebank.kz сайты арқылы Halyk Bank-ке жүгінуге.',
        'Компанияның орналасқан жеріндегі сотқа жүгінуге (Астана қ., ҚР).',
      ],
    },
    {
      title: '8. Шарттарға өзгерістер',
      paragraphs: [
        'Компания осы Шарттарды жаңарту құқығын өзінде қалдырады. Өзекті нұсқа әрқашан medtour.nnmc.kz/terms мекенжайында қолжетімді. Өзгерістер жарияланғаннан кейін Платформаны пайдалануды жалғастыру сіздің олармен келісетініңізді білдіреді.',
      ],
    },
    {
      title: '9. Байланыс ақпараты',
      bullets: [
        'Компания: «ННМЦ Диджитал» ЖШС',
        'Мекенжай: Астана қ., Абылай хан даңғылы, 42',
        'Телефон: +7 (7172) 123-456',
        'Email: info@medtour.kz',
      ],
    },
  ],
  paymentPartnerTitle: 'Төлем серіктесі — «Қазақстан Халық Банкі» АҚ',
  paymentPartnerText: 'Онлайн-төлемдер 3-D Secure технологиясын қолдана отырып ePay by Halyk қорғалған төлем шлюзі арқылы өңделеді. Картаңыздың деректері Платформа серверлеріне берілмейді және онда сақталмайды.',
  refundTitle: '4. Бас тарту және қаражатты қайтару тәртібі',
  refundColumns: ['Жағдай', 'Қайтару', 'Мерзімі'],
  refundRows: [
    ['Пациент қабылдауға 24 сағаттан артық уақыт қалғанда бас тартты', '100%', '3-5 жұмыс күні'],
    ['Пациент қабылдауға 24 сағаттан аз уақыт қалғанда бас тартты', 'Қарастырылмаған', '-'],
    ['Дәрігер кеңеске келмеді', '100%', '1-3 жұмыс күні'],
    ['Платформа кінәсінен болған техникалық ақау', '100%', '1-3 жұмыс күні'],
    ['Кеңес толық көлемде өтті', 'Қарастырылмаған', '-'],
  ],
  refundRequestTitle: 'Қайтаруды қалай сұрауға болады',
  refundRequestText: 'Жазба нөмірі мен қайтару себебін көрсетіп, info@medtour.kz мекенжайына жазыңыз немесе +7 (7172) 123-456 нөміріне қоңырау шалыңыз. Қаражат төлем жасалған картаға қайтарылады.',
}
