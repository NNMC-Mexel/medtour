const heroImage = '/treatments/medical-department-hero.png'

const commonJourney = [
  'Предварительный разбор медицинских документов',
  'Онлайн-консультация и индивидуальный план',
  'Диагностика, госпитализация и лечение',
  'Выписка, перевод рекомендаций и дистанционное наблюдение',
]

const commonBenefits = [
  'Диагностика большинства случаев за 1–3 рабочих дня',
  'Персональный координатор и переводчик',
  'Помощь с приглашением, размещением и трансфером',
  'Онлайн-консультации до приезда и после выписки',
]

const commonJourneyEn = [
  'Preliminary review of medical records',
  'Online consultation and a personalized plan',
  'Diagnostics, hospitalization and treatment',
  'Discharge, translated recommendations and remote follow-up',
]

const commonBenefitsEn = [
  'Most diagnostic programs completed within 1–3 business days',
  'Personal coordinator and interpreter',
  'Support with invitation letters, accommodation and transfers',
  'Online consultations before arrival and after discharge',
]

const commonJourneyKk = [
  'Медициналық құжаттарды алдын ала талдау',
  'Онлайн-консультация және жеке емдеу жоспары',
  'Диагностика, ауруханаға жатқызу және емдеу',
  'Ауруханадан шығару, ұсынымдарды аудару және қашықтан бақылау',
]

const commonBenefitsKk = [
  'Көп жағдайда диагностика 1–3 жұмыс күнінде аяқталады',
  'Жеке үйлестіруші және аудармашы',
  'Шақыру хаты, тұру орны және трансфер бойынша көмек',
  'Келгенге дейін және ауруханадан шыққаннан кейін онлайн-консультациялар',
]

export const treatmentUi = {
  ru: {
    badge: 'Лечение в ННМЦ', back: 'Все направления', services: 'Что мы лечим и выполняем',
    servicesLead: 'Команда формирует маршрут под диагноз пациента — от диагностики до восстановления.',
    programs: 'Приоритетные программы', programsLead: 'Наиболее востребованные варианты лечения для иностранных пациентов.',
    conditions: 'С какими заболеваниями обращаются', technology: 'Технологии и оснащение',
    journey: 'Как проходит лечение', journeyLead: 'Один управляемый процесс вместо самостоятельной координации клиники, врачей и поездки.',
    benefits: 'Для иностранных пациентов', doctors: 'Команда направления',
    doctorsLead: 'Врачи платформы, чья специализация соответствует этому направлению.',
    noDoctors: 'Врачи этого направления добавляются на платформу. Заявку уже можно отправить — координатор подберёт команду.',
    duration: 'Длительность', stay: 'Госпитализация', request: 'Получить план лечения',
    discuss: 'Обсудить мой случай', ctaTitle: 'Получите персональный маршрут лечения',
    ctaText: 'Загрузите выписки и исследования. Медицинская команда оценит случай и подготовит следующие шаги до вашей поездки.',
    sourceNote: 'Содержание подготовлено по анкете профильного отделения ННМЦ.', specialists: 'профильных программ',
    previousDoctors: 'Предыдущие врачи', nextDoctors: 'Следующие врачи',
  },
  en: {
    badge: 'Treatment at NNMC', back: 'All departments', services: 'Conditions and procedures',
    servicesLead: 'The team builds a diagnosis-led route from assessment through recovery.',
    programs: 'Priority programs', programsLead: 'High-demand treatment options for international patients.',
    conditions: 'Common conditions', technology: 'Technology and equipment', journey: 'Your treatment journey',
    journeyLead: 'One managed process instead of coordinating the clinic, doctors and travel yourself.',
    benefits: 'For international patients', doctors: 'Department specialists',
    doctorsLead: 'Platform doctors whose specialization matches this department.',
    noDoctors: 'Doctors for this department are being added. You can already submit a case and a coordinator will assemble the team.',
    duration: 'Duration', stay: 'Hospital stay', request: 'Get a treatment plan', discuss: 'Discuss my case',
    ctaTitle: 'Get your personal treatment route', ctaText: 'Upload your reports and imaging. The medical team will review your case and outline the next steps before you travel.',
    sourceNote: 'Content is based on the NNMC department questionnaire.', specialists: 'specialized programs',
    previousDoctors: 'Previous doctors', nextDoctors: 'Next doctors',
  },
  kk: {
    badge: 'ҰҒМО-да емделу', back: 'Барлық бөлімдер', services: 'Емдеу және операциялар',
    servicesLead: 'Команда диагностикадан оңалтуға дейін диагнозға сай жеке бағыт құрады.',
    programs: 'Басым бағдарламалар', programsLead: 'Шетелдік пациенттер үшін сұранысқа ие емдеу бағыттары.',
    conditions: 'Жиі кездесетін аурулар', technology: 'Технологиялар мен жабдықтар', journey: 'Емдеу қалай өтеді',
    journeyLead: 'Клиника, дәрігерлер және сапарды өзіңіз үйлестірудің орнына бір басқарылатын процесс.',
    benefits: 'Шетелдік пациенттерге', doctors: 'Бағыт мамандары',
    doctorsLead: 'Мамандығы осы бөлімге сәйкес келетін платформа дәрігерлері.',
    noDoctors: 'Бұл бағыттың дәрігерлері платформаға қосылып жатыр. Өтінімді қазір жіберуге болады — үйлестіруші команданы таңдайды.',
    duration: 'Ұзақтығы', stay: 'Стационарда', request: 'Емдеу жоспарын алу', discuss: 'Жағдайымды талқылау',
    ctaTitle: 'Жеке емдеу бағытын алыңыз', ctaText: 'Қорытындылар мен зерттеулерді жүктеңіз. Медициналық команда сапарға дейін жағдайды бағалап, келесі қадамдарды ұсынады.',
    sourceNote: 'Мазмұн ҰҒМО профильдік бөлімінің сауалнамасы негізінде дайындалды.', specialists: 'бейінді бағдарлама',
    previousDoctors: 'Алдыңғы дәрігерлер', nextDoctors: 'Келесі дәрігерлер',
  },
}

export const TREATMENT_DEPARTMENTS = [
  {
    slug: 'neurosurgery', icon: 'Brain', accent: 'violet', heroImage,
    title: { ru: 'Нейрохирургия', en: 'Neurosurgery', kk: 'Нейрохирургия' },
    short: { ru: 'Операции на головном и спинном мозге, сосудах и позвоночнике', en: 'Brain, spinal cord, vascular and spine surgery', kk: 'Ми, жұлын, қан тамырлары және омыртқа хирургиясы' },
    summary: 'Отделение на 15 коек выполняет высокотехнологичные вмешательства при заболеваниях центральной и периферической нервной системы. Современная нейронавигация и микрохирургическая техника помогают проводить сложные операции точно и безопасно.',
    services: ['Удаление опухолей головного и спинного мозга', 'Микрохирургическое лечение межпозвоночных грыж', 'Операции при аневризмах и сосудистых мальформациях', 'Декомпрессия при стенозе позвоночного канала', 'Шунтирующие операции при гидроцефалии', 'Лечение невралгии тройничного нерва'],
    programs: [
      { name: 'Удаление опухолей головного и спинного мозга', text: 'Микрохирургическое удаление с навигацией и сохранением функционально значимых структур.' },
      { name: 'Хирургия позвоночника', text: 'Лечение грыж дисков и стеноза позвоночного канала с малотравматичным доступом.' },
      { name: 'Цереброваскулярная нейрохирургия', text: 'Оперативное лечение аневризм и сосудистых мальформаций головного мозга.' },
    ],
    conditions: ['Опухоли головного и спинного мозга', 'Аневризмы и сосудистые мальформации', 'Грыжи межпозвоночных дисков', 'Стеноз позвоночного канала', 'Гидроцефалия', 'Невралгия тройничного нерва'],
    technology: ['Операционный микроскоп', 'Система нейронавигации', 'Электронно-оптический преобразователь', 'Ангиографическая установка'],
    specialtyMatches: ['Невролог', 'Нейрохирург'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'therapy', icon: 'Stethoscope', accent: 'teal', heroImage,
    title: { ru: 'Терапия №2', en: 'Internal Medicine', kk: 'Терапия №2' },
    short: { ru: 'Комплексная диагностика и лечение заболеваний внутренних органов', en: 'Integrated diagnostics and internal medicine', kk: 'Ішкі ағза ауруларын кешенді диагностикалау және емдеу' },
    summary: 'Мультидисциплинарное отделение помогает пациентам с ревматологическими, эндокринологическими, гастроэнтерологическими, пульмонологическими, нефрологическими и гематологическими заболеваниями. Тактика строится на доказательной медицине и индивидуальном плане.',
    services: ['Консультации терапевта и профильных специалистов', 'Лабораторная и инструментальная диагностика', 'Терапевтический Check-up', 'Трепан-биопсия печени и почек под УЗ-навигацией', 'Инициация генно-инженерной биологической терапии', 'Непрерывный мониторинг глюкозы и подбор терапии'],
    programs: [
      { name: 'Терапевтический Check-up', text: 'Комплексное обследование организма и рекомендации специалистов.', duration: '1–2 дня', stay: 'Не требуется' },
      { name: 'Диагностика ревматологических заболеваний', text: 'Обследование, консультация ревматолога и подбор современной терапии.', duration: '3–5 дней', stay: 'По показаниям' },
      { name: 'Диагностика и лечение сахарного диабета', text: 'Оценка осложнений, коррекция лечения и индивидуальный контроль.', duration: '2–3 дня', stay: '3–7 дней' },
      { name: 'Второе медицинское мнение', text: 'Экспертная оценка документации и ранее назначенного лечения.', duration: '1 день', stay: 'Не требуется' },
    ],
    conditions: ['Аутоиммунные и ревматологические заболевания', 'Сахарный диабет и эндокринные нарушения', 'Хронические заболевания печени и ЖКТ', 'ХОБЛ и интерстициальные болезни лёгких', 'Гематологические заболевания', 'Сложные случаи с неясным диагнозом'],
    technology: ['КТ и МРТ', 'УЗИ экспертного класса', 'ВГДС и колоноскопия', 'Непрерывный мониторинг глюкозы', 'Полисомнография', 'Неинвазивная вентиляция лёгких'],
    specialtyMatches: ['Терапевт', 'Эндокринолог', 'Гастроэнтеролог', 'Ревматолог', 'Пульмонолог', 'Гематолог', 'Нефролог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'urology', icon: 'ScanLine', accent: 'sky', heroImage,
    title: { ru: 'Урология', en: 'Urology', kk: 'Урология' },
    short: { ru: 'Эндоскопическая, лазерная и реконструктивная урология', en: 'Endoscopic, laser and reconstructive urology', kk: 'Эндоскопиялық, лазерлік және реконструктивті урология' },
    summary: 'Экспертный центр диагностики и малоинвазивного лечения урологических и андрологических заболеваний. Команда использует эндоскопические, лапароскопические, лазерные и реконструктивные технологии для быстрого восстановления.',
    services: ['PCNL, Mini-PCNL и RIRS при мочекаменной болезни', 'Лазерная литотрипсия камней', 'HoLEP и ТУР предстательной железы', 'Лапароскопическая резекция почки и нефрэктомия', 'Реконструктивные операции при стриктурах', 'Фаллопротезирование и лечение недержания мочи'],
    programs: [
      { name: 'Комплексное лечение мочекаменной болезни', text: 'Подбор RIRS, PCNL, Mini-PCNL или дистанционной литотрипсии под анатомию камня.', duration: '1–2 часа', stay: '2–5 дней' },
      { name: 'HoLEP', text: 'Гольмиевая лазерная энуклеация гиперплазии предстательной железы любого объёма.', duration: '1–2 часа', stay: '3–4 дня' },
      { name: 'Лапароскопические операции на почках', text: 'Органосохраняющее лечение опухолей, кист, гидронефроза и стриктур.', duration: '2–4 часа', stay: '3–5 дней' },
      { name: 'Реконструктивная урология', text: 'Восстановление мочеточника и уретры после травм, воспалений или операций.', duration: '2–4 часа', stay: '4–7 дней' },
    ],
    conditions: ['Камни почек и мочеточников', 'Гиперплазия предстательной железы', 'Опухоли почки, мочевого пузыря и простаты', 'Гидронефроз', 'Стриктуры мочеточника и уретры', 'Эректильная дисфункция и недержание мочи'],
    technology: ['Гольмиевый лазер', 'Гибкие эндоскопы', 'Лапароскопические стойки', 'УЗ-навигация', 'Оборудование для дистанционной литотрипсии'],
    specialtyMatches: ['Уролог', 'Андролог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'general-thoracic-surgery', icon: 'Syringe', accent: 'amber', heroImage,
    title: { ru: 'Общая и торакальная хирургия', en: 'General & Thoracic Surgery', kk: 'Жалпы және торакалдық хирургия' },
    short: { ru: 'Лапароскопическая, онкологическая и торакоскопическая хирургия', en: 'Laparoscopic, oncological and thoracoscopic surgery', kk: 'Лапароскопиялық, онкологиялық және торакоскопиялық хирургия' },
    summary: 'Отделение выполняет открытые, лапароскопические, торакоскопические и малоинвазивные вмешательства по международным клиническим рекомендациям — от хирургии печени и ЖКТ до VATS-операций на лёгких.',
    services: ['Хирургия печени и желчевыводящих путей', 'Операции на поджелудочной железе и желудке', 'Колоректальная и онкологическая хирургия', 'Лапароскопическое лечение грыж', 'VATS-биопсия и резекция лёгкого', 'Реконструктивные операции на кишечнике'],
    programs: [
      { name: 'Лапароскопическая колоректальная хирургия', text: 'Операции при опухолях толстой и прямой кишки с соблюдением стандартов TME.', duration: '2–5 часов', stay: '5–8 дней' },
      { name: 'Радикальная хирургия желудка', text: 'Гастрэктомия с лимфодиссекцией D2 лапароскопическим или открытым доступом.', duration: '3–6 часов', stay: '7–10 дней' },
      { name: 'Резекции печени', text: 'Органосохраняющее лечение опухолей, кист и эхинококкоза.', duration: '3–6 часов', stay: '6–10 дней' },
      { name: 'Торакоскопическая хирургия', text: 'VATS-диагностика и операции на лёгких через малые доступы.' },
    ],
    conditions: ['Опухоли желудка и кишечника', 'Опухоли и кисты печени', 'Желчнокаменная болезнь', 'Грыжи брюшной стенки и диафрагмы', 'Заболевания поджелудочной железы', 'Опухоли и заболевания лёгких'],
    technology: ['Лапароскопические стойки', 'VATS-оборудование', 'Энергетические хирургические платформы', 'Современные системы гемостаза'],
    specialtyMatches: ['Хирург', 'Торакальный хирург', 'Онколог', 'Колопроктолог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'interventional-cardiology', icon: 'HeartPulse', accent: 'rose', heroImage,
    title: { ru: 'Интервенционная кардиология №1', en: 'Interventional Cardiology', kk: 'Интервенциялық кардиология №1' },
    short: { ru: 'Малоинвазивное лечение сосудов и клапанов сердца', en: 'Minimally invasive vascular and heart valve treatment', kk: 'Қан тамырлары мен жүрек қақпақшаларын аз инвазивті емдеу' },
    summary: 'Одно из ведущих подразделений Казахстана по эндоваскулярному лечению сердца и сосудов. Большинство операций проводится через небольшой сосудистый прокол, что сокращает период восстановления.',
    services: ['Коронарография и ангиография', 'Стентирование коронарных и периферических артерий', 'Реканализация хронических окклюзий (CTO)', 'Внутрисосудистая литотрипсия Shockwave IVL', 'Клипирование митрального клапана (TEER)', 'Транскатетерные вмешательства на аортальном клапане'],
    programs: [
      { name: 'Стентирование коронарных артерий', text: 'Восстановление кровотока через лучевой или бедренный доступ без открытого разреза.', duration: '30–90 минут', stay: '2–5 дней' },
      { name: 'Shockwave IVL', text: 'Внутрисосудистая литотрипсия при тяжёлом кальцинозе коронарных артерий.', duration: '60–120 минут', stay: '3–5 дней' },
      { name: 'Клипирование митрального клапана', text: 'TEER для пациентов с высокой степенью митральной недостаточности и высоким хирургическим риском.', duration: '1,5–3 часа', stay: '3–7 дней' },
      { name: 'Ангиопластика с лекарственным покрытием', text: 'Лечение рестенозов и сосудов малого диаметра без дополнительного стента.', duration: '30–90 минут', stay: '2–4 дня' },
    ],
    conditions: ['Ишемическая болезнь сердца', 'Острый коронарный синдром', 'Хронические окклюзии артерий', 'Митральная недостаточность', 'Аортальный стеноз', 'Резистентная артериальная гипертензия'],
    technology: ['Shockwave IVL', 'IVUS и OCT', 'FFR/iFR', 'Ротационная атерэктомия', 'Системы TEER и TAVI'],
    specialtyMatches: ['Кардиолог', 'Интервенционный кардиолог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'arrhythmology', icon: 'Activity', accent: 'indigo', heroImage,
    title: { ru: 'Аритмология', en: 'Arrhythmology', kk: 'Аритмология' },
    short: { ru: 'Диагностика и интервенционное лечение нарушений ритма', en: 'Diagnosis and interventional treatment of heart rhythm disorders', kk: 'Жүрек ырғағы бұзылыстарын диагностикалау және интервенциялық емдеу' },
    summary: 'Отделение оказывает высокотехнологичную помощь при сложных нарушениях сердечного ритма: от углублённой диагностики до аблации и имплантации современных устройств.',
    services: ['Кардиологический и аритмологический Check-up', 'Электрофизиологическое исследование (ЭФИ)', 'Радиочастотная и криоаблация', 'Имплантация электрокардиостимуляторов', 'Имплантация кардиовертеров-дефибрилляторов', 'Имплантация CRT-P и CRT-D'],
    programs: [
      { name: 'Криоаблация фибрилляции предсердий', text: 'Изоляция устьев лёгочных вен с применением криоконсоли.', duration: '1,5 часа', stay: '5 дней' },
      { name: 'РЧА с 3D-навигацией', text: 'ЭФИ и аблация с системами Carto 3 или EnsiteX.', duration: '2,5 часа', stay: '5 дней' },
      { name: 'Имплантация электрокардиостимулятора', text: 'Физиологическая стимуляция проводящей системы сердца.', duration: '1 час', stay: '5 дней' },
      { name: 'Имплантация ICD / CRT', text: 'Профилактика внезапной сердечной смерти и лечение сердечной недостаточности.', duration: '1–1,5 часа', stay: '5 дней' },
    ],
    conditions: ['Фибрилляция и трепетание предсердий', 'Наджелудочковые и желудочковые тахикардии', 'Синдром WPW', 'АВ-блокады II–III степени', 'Синдром слабости синусового узла', 'Хроническая сердечная недостаточность'],
    technology: ['Криоконсоль', 'Carto 3', 'EnsiteX', 'Системы Medtronic, Boston Scientific и Abbott', 'Суточное мониторирование ЭКГ'],
    specialtyMatches: ['Кардиолог', 'Аритмолог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'gynecology', icon: 'Venus', accent: 'pink', heroImage,
    title: { ru: 'Гинекология', en: 'Gynecology', kk: 'Гинекология' },
    short: { ru: 'Органосохраняющая, эндоскопическая и реконструктивная гинекология', en: 'Organ-preserving, endoscopic and reconstructive gynecology', kk: 'Ағзаны сақтайтын, эндоскопиялық және реконструктивті гинекология' },
    summary: 'Отделение обладает многолетним опытом планового лечения заболеваний женской репродуктивной системы. Приоритет — органосохраняющие, лапароскопические, влагалищные и реконструктивные операции с коротким восстановлением.',
    services: ['Лапароскопическая миомэктомия', 'Операции при эндометриозе и спаечном процессе', 'Гистероскопия и гистерорезектоскопия', 'Эмболизация маточных артерий и РЧ-абляция', 'Реконструкция тазового дна', 'TVT-O при стрессовом недержании мочи'],
    programs: [
      { name: 'Органосохраняющее лечение миомы', text: 'Удаление миоматозных узлов с сохранением менструальной и репродуктивной функции.' },
      { name: 'Лапароскопическая хирургия', text: 'Операции при эндометриозе, кистах, спаечном процессе и трубном бесплодии.' },
      { name: 'Внутриматочная хирургия', text: 'Удаление полипов, субмукозной миомы, синехий и внутриматочной перегородки.' },
      { name: 'Реконструктивная гинекология', text: 'Восстановление тазового дна и лечение пролапса тазовых органов.' },
    ],
    conditions: ['Миома матки', 'Эндометриоз', 'Доброкачественные образования яичников', 'Трубно-перитонеальное бесплодие', 'Патология эндометрия и цервикального канала', 'Пролапс тазовых органов'],
    technology: ['Лапароскопическое оборудование', 'Гистерорезектоскоп', 'Радиочастотная абляция', 'Эндоваскулярная эмболизация', 'Сетчатые системы TVT-O'],
    specialtyMatches: ['Гинеколог', 'Акушер-гинеколог'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'cardiac-surgery', icon: 'Heart', accent: 'red', heroImage,
    title: { ru: 'Кардиохирургия и реабилитация', en: 'Cardiac Surgery & Rehabilitation', kk: 'Кардиохирургия және оңалту' },
    short: { ru: 'Открытая и малоинвазивная хирургия сердца и аорты', en: 'Open and minimally invasive heart and aortic surgery', kk: 'Жүрек пен аортаның ашық және аз инвазивті хирургиясы' },
    summary: 'Отделение выполняет более 650 операций на открытом сердце ежегодно, включая сложные и повторные вмешательства. Развиваются малоинвазивные технологии, ускоренное восстановление и послеоперационная реабилитация.',
    services: ['Аортокоронарное шунтирование', 'Миниинвазивное шунтирование MIDCAB / TCRAT', 'Пластика и протезирование клапанов', 'Операции на корне, восходящей аорте и дуге', 'Комбинированные и повторные операции', 'Хирургическое лечение фибрилляции предсердий MAZE'],
    programs: [
      { name: 'Аортокоронарное шунтирование', text: 'Полная реваскуляризация миокарда при многососудистом поражении.', duration: '2–4 часа', stay: '7–10 дней' },
      { name: 'Миниинвазивное коронарное шунтирование', text: 'Операция без полного рассечения грудины с более быстрым восстановлением.', duration: '2–4 часа', stay: '5–7 дней' },
      { name: 'Пластика и протезирование клапанов', text: 'Реконструкция собственного клапана или установка современного протеза.', duration: '3–5 часов', stay: '7–10 дней' },
      { name: 'Хирургия аорты', text: 'Сложные реконструктивные операции при аневризме и расслоении аорты.', duration: '5–8 часов', stay: '10–14 дней' },
    ],
    conditions: ['Ишемическая болезнь сердца', 'Пороки клапанов сердца', 'Аневризма и расслоение аорты', 'Фибрилляция предсердий', 'Врождённые пороки сердца у взрослых', 'Сниженная фракция выброса'],
    technology: ['Аппараты искусственного кровообращения', 'Современная защита головного мозга', 'Малоинвазивные доступы MICS', 'Протоколы ускоренной реабилитации'],
    specialtyMatches: ['Кардиолог', 'Кардиохирург'], journey: commonJourney, benefits: commonBenefits,
  },
  {
    slug: 'heart-institute', icon: 'HeartPulse', accent: 'rose', heroImage,
    title: { ru: 'Институт сердца', en: 'Heart Institute', kk: 'Жүрек институты' },
    short: { ru: 'Полный цикл диагностики и лечения заболеваний сердца и сосудов', en: 'Complete diagnosis and treatment for heart and vascular disease', kk: 'Жүрек пен қан тамырлары ауруларын толық диагностикалау және емдеу' },
    summary: 'Институт сердца ННМЦ объединяет кардиохирургию, интервенционную кардиологию и аритмологию. Пациент получает комплексную диагностику, индивидуальный план и полный цикл лечения — от дистанционной оценки документов до операции и послеоперационной реабилитации.',
    services: ['Консультации кардиохирурга, интервенционного кардиолога и аритмолога', 'ЭКГ, Холтер, эхокардиография, КТ сердца и коронарография', 'Аортокоронарное шунтирование и операции на клапанах', 'Стентирование, IVUS, OCT, FFR/iFR и лечение CTO', 'Радиочастотная и криоаблация', 'Имплантация кардиостимуляторов, CRT и ICD', 'Кардиологическая реабилитация и Check-up программы'],
    programs: [
      { name: 'Малоинвазивное аортокоронарное шунтирование', text: 'Восстановление кровоснабжения миокарда, в том числе на работающем сердце и через минимальный доступ.', duration: '4–6 часов', stay: '7–10 дней' },
      { name: 'Хирургия клапанов сердца', text: 'Пластика или замена клапана современным протезом, при возможности — малоинвазивным доступом.', duration: '3–5 часов', stay: '7–10 дней' },
      { name: 'Стентирование коронарных артерий', text: 'Малоинвазивное восстановление кровотока с внутрисосудистой визуализацией IVUS или OCT.', duration: '30–90 минут', stay: '1–3 дня' },
      { name: 'Катетерная аблация аритмий', text: 'Радиочастотное или криогенное лечение фибрилляции предсердий и других тахикардий.', duration: '2–4 часа', stay: '2–3 дня' },
      { name: 'Cardio Check-up', text: 'Комплексная оценка сердечно-сосудистого риска с заключением специалистов и индивидуальным планом.', duration: '1–3 дня', stay: 'Не требуется' },
    ],
    conditions: ['Ишемическая болезнь сердца', 'Пороки клапанов сердца', 'Нарушения сердечного ритма', 'Аневризма и расслоение аорты', 'Хроническая сердечная недостаточность', 'Врождённые пороки сердца у взрослых'],
    technology: ['Экспертная эхокардиография и КТ сердца', 'Ангиография, IVUS, OCT и FFR/iFR', 'Системы 3D-навигации и криоаблации', 'Аппараты искусственного кровообращения', 'Современные кардиостимуляторы, CRT и ICD'],
    specialtyMatches: ['Кардиолог', 'Кардиохирург', 'Интервенционный кардиолог', 'Аритмолог'], journey: commonJourney, benefits: commonBenefits,
  },
]

const EN_CONTENT = {
  neurosurgery: {
    summary: 'This 15-bed department provides high-technology surgery for conditions of the central and peripheral nervous systems. Modern neuronavigation and microsurgical equipment help the team perform complex procedures with precision and safety.',
    services: ['Brain and spinal cord tumor removal', 'Microsurgical treatment of herniated discs', 'Surgery for cerebral aneurysms and vascular malformations', 'Decompression for spinal canal stenosis', 'Shunt surgery for hydrocephalus', 'Treatment of trigeminal neuralgia'],
    programs: [
      { name: 'Brain and spinal cord tumor surgery', text: 'Microsurgical removal with navigation while preserving functionally important structures.' },
      { name: 'Spine surgery', text: 'Minimally traumatic treatment of herniated discs and spinal canal stenosis.' },
      { name: 'Cerebrovascular neurosurgery', text: 'Surgical treatment of cerebral aneurysms and vascular malformations.' },
    ],
    conditions: ['Brain and spinal cord tumors', 'Aneurysms and vascular malformations', 'Herniated discs', 'Spinal canal stenosis', 'Hydrocephalus', 'Trigeminal neuralgia'],
    technology: ['Operating microscope', 'Neuronavigation system', 'Mobile C-arm imaging', 'Angiography system'],
  },
  therapy: {
    summary: 'This multidisciplinary internal medicine department treats rheumatological, endocrine, gastrointestinal, respiratory, renal and hematological conditions. Care follows evidence-based guidelines and an individualized diagnostic and treatment plan.',
    services: ['Consultations with an internist and relevant specialists', 'Laboratory and instrumental diagnostics', 'Comprehensive internal medicine check-up', 'Ultrasound-guided liver and kidney core biopsy', 'Initiation of biologic therapy', 'Continuous glucose monitoring and treatment adjustment'],
    programs: [
      { name: 'Internal Medicine Check-up', text: 'Comprehensive health assessment with recommendations from relevant specialists.', duration: '1–2 days', stay: 'Not required' },
      { name: 'Rheumatology assessment', text: 'Diagnostic work-up, rheumatologist consultation and selection of modern therapy.', duration: '3–5 days', stay: 'When indicated' },
      { name: 'Diabetes assessment and treatment', text: 'Complication screening, treatment adjustment and an individualized monitoring plan.', duration: '2–3 days', stay: '3–7 days' },
      { name: 'Second medical opinion', text: 'Expert review of medical records, diagnosis and previously prescribed treatment.', duration: '1 day', stay: 'Not required' },
    ],
    conditions: ['Autoimmune and rheumatological diseases', 'Diabetes and endocrine disorders', 'Chronic liver and gastrointestinal diseases', 'COPD and interstitial lung diseases', 'Hematological diseases', 'Complex cases with an unclear diagnosis'],
    technology: ['CT and MRI', 'Expert-class ultrasound', 'Upper endoscopy and colonoscopy', 'Continuous glucose monitoring', 'Polysomnography', 'Non-invasive ventilation'],
  },
  urology: {
    summary: 'An expert center for diagnosing and treating urological and andrological conditions with minimally invasive techniques. The team uses endoscopic, laparoscopic, laser and reconstructive technologies to support faster recovery.',
    services: ['PCNL, Mini-PCNL and RIRS for urinary stones', 'Laser stone fragmentation', 'HoLEP and transurethral prostate surgery', 'Laparoscopic partial nephrectomy and nephrectomy', 'Reconstructive surgery for strictures', 'Penile prosthesis surgery and urinary incontinence treatment'],
    programs: [
      { name: 'Comprehensive urinary stone treatment', text: 'Selection of RIRS, PCNL, Mini-PCNL or extracorporeal lithotripsy according to stone anatomy.', duration: '1–2 hours', stay: '2–5 days' },
      { name: 'HoLEP', text: 'Holmium laser enucleation for benign prostatic enlargement of any volume.', duration: '1–2 hours', stay: '3–4 days' },
      { name: 'Laparoscopic kidney surgery', text: 'Organ-preserving treatment of tumors, cysts, hydronephrosis and strictures.', duration: '2–4 hours', stay: '3–5 days' },
      { name: 'Reconstructive urology', text: 'Reconstruction of the ureter and urethra after injury, inflammation or previous surgery.', duration: '2–4 hours', stay: '4–7 days' },
    ],
    conditions: ['Kidney and ureteral stones', 'Benign prostatic enlargement', 'Kidney, bladder and prostate tumors', 'Hydronephrosis', 'Ureteral and urethral strictures', 'Erectile dysfunction and urinary incontinence'],
    technology: ['Holmium laser', 'Flexible endoscopes', 'Laparoscopic systems', 'Ultrasound guidance', 'Extracorporeal lithotripsy equipment'],
  },
  'general-thoracic-surgery': {
    summary: 'The department performs open, laparoscopic, thoracoscopic and other minimally invasive procedures in line with international clinical guidelines—from hepatobiliary and gastrointestinal surgery to VATS lung procedures.',
    services: ['Liver and biliary tract surgery', 'Pancreatic and gastric surgery', 'Colorectal and cancer surgery', 'Laparoscopic hernia repair', 'VATS lung biopsy and resection', 'Reconstructive bowel surgery'],
    programs: [
      { name: 'Laparoscopic colorectal surgery', text: 'Surgery for colon and rectal tumors according to oncological standards, including TME.', duration: '2–5 hours', stay: '5–8 days' },
      { name: 'Radical gastric surgery', text: 'Laparoscopic or open gastrectomy with D2 lymph node dissection.', duration: '3–6 hours', stay: '7–10 days' },
      { name: 'Liver resection', text: 'Organ-preserving treatment of liver tumors, cysts and echinococcosis.', duration: '3–6 hours', stay: '6–10 days' },
      { name: 'Thoracoscopic surgery', text: 'Minimally invasive VATS diagnostics and lung surgery.' },
    ],
    conditions: ['Stomach and colorectal tumors', 'Liver tumors and cysts', 'Gallstone disease', 'Abdominal wall and diaphragmatic hernias', 'Pancreatic diseases', 'Lung tumors and other thoracic conditions'],
    technology: ['Laparoscopic systems', 'VATS equipment', 'Advanced surgical energy platforms', 'Modern hemostasis systems'],
  },
  'interventional-cardiology': {
    summary: 'One of Kazakhstan’s leading departments for endovascular treatment of cardiovascular disease. Most procedures are performed through a small vascular puncture, helping shorten recovery time.',
    services: ['Coronary angiography and peripheral angiography', 'Coronary and peripheral artery stenting', 'Chronic total occlusion recanalization (CTO)', 'Shockwave intravascular lithotripsy (IVL)', 'Transcatheter edge-to-edge mitral repair (TEER)', 'Transcatheter aortic valve procedures'],
    programs: [
      { name: 'Coronary artery stenting', text: 'Restoration of coronary blood flow through radial or femoral access without open surgery.', duration: '30–90 minutes', stay: '2–5 days' },
      { name: 'Shockwave IVL', text: 'Intravascular lithotripsy for severely calcified coronary artery disease.', duration: '60–120 minutes', stay: '3–5 days' },
      { name: 'Transcatheter mitral valve repair', text: 'TEER for severe mitral regurgitation in patients at high surgical risk.', duration: '1.5–3 hours', stay: '3–7 days' },
      { name: 'Drug-coated balloon angioplasty', text: 'Treatment of restenosis and small vessels without placing an additional stent.', duration: '30–90 minutes', stay: '2–4 days' },
    ],
    conditions: ['Coronary artery disease', 'Acute coronary syndrome', 'Chronic arterial occlusions', 'Mitral regurgitation', 'Aortic stenosis', 'Resistant arterial hypertension'],
    technology: ['Shockwave IVL', 'IVUS and OCT', 'FFR/iFR', 'Rotational atherectomy', 'TEER and TAVI systems'],
  },
  arrhythmology: {
    summary: 'The department provides high-technology care for complex heart rhythm disorders, from advanced diagnostics to catheter ablation and implantation of modern cardiac devices.',
    services: ['Cardiology and arrhythmology check-up', 'Electrophysiology study (EPS)', 'Radiofrequency and cryoballoon ablation', 'Pacemaker implantation', 'Implantable cardioverter-defibrillator placement', 'CRT-P and CRT-D implantation'],
    programs: [
      { name: 'Cryoballoon ablation for atrial fibrillation', text: 'Pulmonary vein isolation using a modern cryoablation system.', duration: '1.5 hours', stay: '5 days' },
      { name: 'Radiofrequency ablation with 3D mapping', text: 'Electrophysiology study and ablation using Carto 3 or EnsiteX navigation.', duration: '2.5 hours', stay: '5 days' },
      { name: 'Pacemaker implantation', text: 'Physiological pacing of the cardiac conduction system.', duration: '1 hour', stay: '5 days' },
      { name: 'ICD / CRT implantation', text: 'Prevention of sudden cardiac death and treatment of heart failure.', duration: '1–1.5 hours', stay: '5 days' },
    ],
    conditions: ['Atrial fibrillation and flutter', 'Supraventricular and ventricular tachycardia', 'Wolff–Parkinson–White syndrome', 'Second- and third-degree AV block', 'Sick sinus syndrome', 'Chronic heart failure'],
    technology: ['Cryoablation system', 'Carto 3', 'EnsiteX', 'Medtronic, Boston Scientific and Abbott devices', '24-hour ECG monitoring'],
  },
  gynecology: {
    summary: 'The department has extensive experience in planned treatment of female reproductive system conditions. Priorities include organ-preserving, laparoscopic, vaginal and reconstructive surgery with a shorter recovery period.',
    services: ['Laparoscopic myomectomy', 'Surgery for endometriosis and pelvic adhesions', 'Hysteroscopy and hysteroscopic resection', 'Uterine artery embolization and radiofrequency ablation', 'Pelvic floor reconstruction', 'TVT-O surgery for stress urinary incontinence'],
    programs: [
      { name: 'Organ-preserving fibroid treatment', text: 'Removal of uterine fibroids while preserving menstrual and reproductive function.' },
      { name: 'Laparoscopic gynecological surgery', text: 'Surgery for endometriosis, ovarian cysts, adhesions and tubal infertility.' },
      { name: 'Intrauterine surgery', text: 'Removal of polyps, submucosal fibroids, adhesions and uterine septa.' },
      { name: 'Reconstructive gynecology', text: 'Pelvic floor reconstruction and treatment of pelvic organ prolapse.' },
    ],
    conditions: ['Uterine fibroids', 'Endometriosis', 'Benign ovarian masses', 'Tubal-peritoneal infertility', 'Endometrial and cervical canal disorders', 'Pelvic organ prolapse'],
    technology: ['Laparoscopic equipment', 'Hysteroscopic resection system', 'Radiofrequency ablation', 'Endovascular embolization', 'TVT-O sling systems'],
  },
  'cardiac-surgery': {
    summary: 'The department performs more than 650 open-heart procedures each year, including complex and repeat surgery. Its priorities include minimally invasive techniques, accelerated recovery and postoperative rehabilitation.',
    services: ['Coronary artery bypass grafting', 'Minimally invasive MIDCAB / TCRAT bypass surgery', 'Heart valve repair and replacement', 'Aortic root, ascending aorta and arch surgery', 'Combined and repeat cardiac surgery', 'Surgical treatment of atrial fibrillation (MAZE)'],
    programs: [
      { name: 'Coronary artery bypass grafting', text: 'Complete myocardial revascularization for multivessel coronary artery disease.', duration: '2–4 hours', stay: '7–10 days' },
      { name: 'Minimally invasive coronary bypass surgery', text: 'Bypass surgery without full sternotomy, supporting faster recovery.', duration: '2–4 hours', stay: '5–7 days' },
      { name: 'Heart valve repair and replacement', text: 'Reconstruction of the patient’s own valve or implantation of a modern prosthesis.', duration: '3–5 hours', stay: '7–10 days' },
      { name: 'Aortic surgery', text: 'Complex reconstructive surgery for aortic aneurysm and dissection.', duration: '5–8 hours', stay: '10–14 days' },
    ],
    conditions: ['Coronary artery disease', 'Heart valve disease', 'Aortic aneurysm and dissection', 'Atrial fibrillation', 'Adult congenital heart disease', 'Reduced left ventricular ejection fraction'],
    technology: ['Cardiopulmonary bypass systems', 'Modern cerebral protection techniques', 'Minimally invasive MICS access', 'Enhanced recovery protocols'],
  },
  'heart-institute': {
    summary: 'The NNMC Heart Institute brings cardiac surgery, interventional cardiology and arrhythmology together in one center. International patients receive coordinated diagnostics, an individual plan and complete care from remote record review through treatment and rehabilitation.',
    services: ['Cardiac surgeon, interventional cardiologist and arrhythmologist consultations', 'ECG, Holter monitoring, echocardiography, cardiac CT and coronary angiography', 'Coronary bypass and heart valve surgery', 'PCI, IVUS, OCT, FFR/iFR and CTO treatment', 'Radiofrequency and cryoablation', 'Pacemaker, CRT and ICD implantation', 'Cardiac rehabilitation and check-up programs'],
    programs: [
      { name: 'Minimally invasive coronary bypass', text: 'Restoration of myocardial blood flow, including off-pump and minimally invasive approaches.', duration: '4–6 hours', stay: '7–10 days' },
      { name: 'Heart valve surgery', text: 'Valve repair or replacement with a modern prosthesis, using minimally invasive access when suitable.', duration: '3–5 hours', stay: '7–10 days' },
      { name: 'Coronary artery stenting', text: 'Minimally invasive blood-flow restoration supported by IVUS or OCT imaging.', duration: '30–90 minutes', stay: '1–3 days' },
      { name: 'Catheter ablation for arrhythmia', text: 'Radiofrequency or cryoablation for atrial fibrillation and other tachyarrhythmias.', duration: '2–4 hours', stay: '2–3 days' },
      { name: 'Cardio check-up', text: 'Comprehensive cardiovascular risk assessment with specialist conclusions and a personal plan.', duration: '1–3 days', stay: 'Outpatient' },
    ],
    conditions: ['Coronary artery disease', 'Heart valve disease', 'Heart rhythm disorders', 'Aortic aneurysm and dissection', 'Chronic heart failure', 'Adult congenital heart disease'],
    technology: ['Expert echocardiography and cardiac CT', 'Angiography, IVUS, OCT and FFR/iFR', '3D mapping and cryoablation systems', 'Cardiopulmonary bypass systems', 'Modern pacemakers, CRT and ICD devices'],
  },
}

const KK_CONTENT = {
  neurosurgery: {
    summary: '15 төсектік бөлімше орталық және шеткі жүйке жүйесі аурулары кезінде жоғары технологиялық операциялар жасайды. Заманауи нейронавигация мен микрохирургиялық техника күрделі операцияларды дәл әрі қауіпсіз орындауға көмектеседі.',
    services: ['Ми және жұлын ісіктерін алып тастау', 'Омыртқааралық жарықтарды микрохирургиялық емдеу', 'Аневризмалар мен қан тамырлары мальформацияларына операция жасау', 'Омыртқа өзегі стенозы кезінде декомпрессия', 'Гидроцефалия кезіндегі шунттау операциялары', 'Үшкіл жүйке невралгиясын емдеу'],
    programs: [
      { name: 'Ми және жұлын ісіктерінің хирургиясы', text: 'Функциялық маңызды құрылымдарды сақтай отырып, навигация көмегімен микрохирургиялық алып тастау.' },
      { name: 'Омыртқа хирургиясы', text: 'Диск жарықтары мен омыртқа өзегі стенозын аз жарақаттайтын әдіспен емдеу.' },
      { name: 'Цереброваскулярлық нейрохирургия', text: 'Ми аневризмалары мен қан тамырлары мальформацияларын хирургиялық емдеу.' },
    ],
    conditions: ['Ми және жұлын ісіктері', 'Аневризмалар мен қан тамырлары мальформациялары', 'Омыртқааралық диск жарықтары', 'Омыртқа өзегінің стенозы', 'Гидроцефалия', 'Үшкіл жүйке невралгиясы'],
    technology: ['Операциялық микроскоп', 'Нейронавигация жүйесі', 'Мобильді рентгендік C-доға', 'Ангиографиялық қондырғы'],
  },
  therapy: {
    summary: 'Көпсалалы ішкі аурулар бөлімшесі ревматологиялық, эндокринологиялық, гастроэнтерологиялық, пульмонологиялық, нефрологиялық және гематологиялық аурулары бар пациенттерді емдейді. Емдеу тактикасы дәлелді медицина қағидалары мен жеке жоспарға негізделеді.',
    services: ['Терапевт және бейінді мамандар консультациясы', 'Зертханалық және аспаптық диагностика', 'Кешенді терапиялық Check-up', 'УДЗ бақылауымен бауыр мен бүйректің трепан-биопсиясы', 'Гендік-инженериялық биологиялық терапияны бастау', 'Глюкозаны үздіксіз бақылау және емді түзету'],
    programs: [
      { name: 'Терапиялық Check-up', text: 'Ағзаны кешенді тексеру және бейінді мамандардың ұсынымдары.', duration: '1–2 күн', stay: 'Қажет емес' },
      { name: 'Ревматологиялық ауруларды диагностикалау', text: 'Тексеру, ревматолог консультациясы және заманауи емді таңдау.', duration: '3–5 күн', stay: 'Көрсетілім бойынша' },
      { name: 'Қант диабетін диагностикалау және емдеу', text: 'Асқынуларды бағалау, емді түзету және жеке бақылау жоспары.', duration: '2–3 күн', stay: '3–7 күн' },
      { name: 'Екінші медициналық пікір', text: 'Медициналық құжаттар мен бұрын тағайындалған емді сараптамалық бағалау.', duration: '1 күн', stay: 'Қажет емес' },
    ],
    conditions: ['Аутоиммундық және ревматологиялық аурулар', 'Қант диабеті және эндокриндік бұзылыстар', 'Бауыр мен асқазан-ішек жолының созылмалы аурулары', 'ӨСОА және өкпенің интерстициалды аурулары', 'Гематологиялық аурулар', 'Диагнозы анық емес күрделі жағдайлар'],
    technology: ['КТ және МРТ', 'Сараптамалық деңгейдегі УДЗ', 'ЭГДС және колоноскопия', 'Глюкозаны үздіксіз бақылау', 'Полисомнография', 'Өкпені инвазивті емес желдету'],
  },
  urology: {
    summary: 'Урологиялық және андрологиялық ауруларды диагностикалау мен аз инвазивті емдеудің сараптамалық орталығы. Команда жылдам оңалту үшін эндоскопиялық, лапароскопиялық, лазерлік және реконструктивті технологияларды қолданады.',
    services: ['Несеп-тас ауруы кезінде PCNL, Mini-PCNL және RIRS', 'Тастарды лазерлік ұсақтау', 'HoLEP және қуықасты безінің трансуретралды операциялары', 'Бүйректің лапароскопиялық резекциясы және нефрэктомия', 'Стриктуралар кезіндегі реконструктивті операциялар', 'Фаллопротездеу және несеп ұстамауды емдеу'],
    programs: [
      { name: 'Несеп-тас ауруын кешенді емдеу', text: 'Тастың анатомиясына қарай RIRS, PCNL, Mini-PCNL немесе қашықтан литотрипсия әдісін таңдау.', duration: '1–2 сағат', stay: '2–5 күн' },
      { name: 'HoLEP', text: 'Кез келген көлемдегі қуықасты безі гиперплазиясын гольмий лазерімен энуклеациялау.', duration: '1–2 сағат', stay: '3–4 күн' },
      { name: 'Бүйрекке лапароскопиялық операциялар', text: 'Ісіктерді, кисталарды, гидронефроз бен стриктураларды ағзаны сақтай отырып емдеу.', duration: '2–4 сағат', stay: '3–5 күн' },
      { name: 'Реконструктивті урология', text: 'Жарақаттан, қабынудан немесе операциядан кейін несепағар мен несеп шығару өзегін қалпына келтіру.', duration: '2–4 сағат', stay: '4–7 күн' },
    ],
    conditions: ['Бүйрек және несепағар тастары', 'Қуықасты безінің қатерсіз гиперплазиясы', 'Бүйрек, қуық және қуықасты безі ісіктері', 'Гидронефроз', 'Несепағар және уретра стриктуралары', 'Эректильді дисфункция және несеп ұстамау'],
    technology: ['Гольмий лазері', 'Иілгіш эндоскоптар', 'Лапароскопиялық жүйелер', 'УДЗ-навигация', 'Қашықтан литотрипсия жабдығы'],
  },
  'general-thoracic-surgery': {
    summary: 'Бөлімше халықаралық клиникалық ұсынымдарға сай ашық, лапароскопиялық, торакоскопиялық және басқа да аз инвазивті операцияларды орындайды: бауыр мен асқазан-ішек жолы хирургиясынан бастап өкпеге VATS-операцияларға дейін.',
    services: ['Бауыр және өт жолдарының хирургиясы', 'Ұйқыбез бен асқазанға операциялар', 'Колоректалдық және онкологиялық хирургия', 'Жарықтарды лапароскопиялық емдеу', 'Өкпенің VATS-биопсиясы және резекциясы', 'Ішекке реконструктивті операциялар'],
    programs: [
      { name: 'Лапароскопиялық колоректалдық хирургия', text: 'TME стандартын сақтай отырып тоқ және тік ішек ісіктеріне операция жасау.', duration: '2–5 сағат', stay: '5–8 күн' },
      { name: 'Асқазанның радикалды хирургиясы', text: 'D2 лимфодиссекциясымен лапароскопиялық немесе ашық гастрэктомия.', duration: '3–6 сағат', stay: '7–10 күн' },
      { name: 'Бауыр резекциясы', text: 'Бауыр ісіктерін, кисталарын және эхинококкозды ағзаны сақтай отырып емдеу.', duration: '3–6 сағат', stay: '6–10 күн' },
      { name: 'Торакоскопиялық хирургия', text: 'Шағын тіліктер арқылы VATS-диагностика және өкпеге операция жасау.' },
    ],
    conditions: ['Асқазан мен ішек ісіктері', 'Бауыр ісіктері мен кисталары', 'Өт-тас ауруы', 'Құрсақ қабырғасы мен көкеттің жарықтары', 'Ұйқыбез аурулары', 'Өкпе ісіктері мен басқа торакалдық аурулар'],
    technology: ['Лапароскопиялық жүйелер', 'VATS-жабдық', 'Хирургиялық энергетикалық платформалар', 'Заманауи гемостаз жүйелері'],
  },
  'interventional-cardiology': {
    summary: 'Жүрек-қан тамырлары ауруларын эндоваскулярлық емдеу бойынша Қазақстандағы жетекші бөлімшелердің бірі. Операциялардың көбі шағын тамырлық пункция арқылы жасалып, оңалу мерзімін қысқартады.',
    services: ['Коронарография және ангиография', 'Коронарлық және шеткі артерияларды стенттеу', 'Созылмалы окклюзияларды реканализациялау (CTO)', 'Shockwave IVL тамырішілік литотрипсиясы', 'Митралды қақпақшаны транскатетерлік клиптеу (TEER)', 'Аорталық қақпақшаға транскатетерлік араласулар'],
    programs: [
      { name: 'Коронарлық артерияларды стенттеу', text: 'Ашық тіліксіз, кәрі жілік немесе сан артериясы арқылы қан ағысын қалпына келтіру.', duration: '30–90 минут', stay: '2–5 күн' },
      { name: 'Shockwave IVL', text: 'Коронарлық артериялардың ауыр кальцинозы кезіндегі тамырішілік литотрипсия.', duration: '60–120 минут', stay: '3–5 күн' },
      { name: 'Митралды қақпақшаны клиптеу', text: 'Митралды жеткіліксіздігі ауыр және хирургиялық қаупі жоғары пациенттерге арналған TEER.', duration: '1,5–3 сағат', stay: '3–7 күн' },
      { name: 'Дәрілік жабындысы бар баллондық ангиопластика', text: 'Рестеноздар мен шағын диаметрлі тамырларды қосымша стентсіз емдеу.', duration: '30–90 минут', stay: '2–4 күн' },
    ],
    conditions: ['Жүректің ишемиялық ауруы', 'Жедел коронарлық синдром', 'Артериялардың созылмалы окклюзиялары', 'Митралды жеткіліксіздік', 'Аорталық стеноз', 'Резистентті артериялық гипертензия'],
    technology: ['Shockwave IVL', 'IVUS және OCT', 'FFR/iFR', 'Ротациялық атерэктомия', 'TEER және TAVI жүйелері'],
  },
  arrhythmology: {
    summary: 'Бөлімше жүрек ырғағының күрделі бұзылыстары кезінде терең диагностикадан бастап катетерлік абляция мен заманауи жүрек құрылғыларын имплантациялауға дейін жоғары технологиялық көмек көрсетеді.',
    services: ['Кардиологиялық және аритмологиялық Check-up', 'Электрофизиологиялық зерттеу (ЭФЗ)', 'Радиожиілікті және криобаллондық абляция', 'Электрокардиостимулятор имплантациясы', 'Имплантацияланатын кардиовертер-дефибриллятор орнату', 'CRT-P және CRT-D имплантациясы'],
    programs: [
      { name: 'Жүрекшелер фибрилляциясының криоабляциясы', text: 'Заманауи криоабляция жүйесімен өкпе веналары сағаларын оқшаулау.', duration: '1,5 сағат', stay: '5 күн' },
      { name: '3D-навигациямен радиожиілікті абляция', text: 'Carto 3 немесе EnsiteX жүйесі арқылы электрофизиологиялық зерттеу және абляция.', duration: '2,5 сағат', stay: '5 күн' },
      { name: 'Электрокардиостимулятор имплантациясы', text: 'Жүректің өткізгіш жүйесін физиологиялық стимуляциялау.', duration: '1 сағат', stay: '5 күн' },
      { name: 'ICD / CRT имплантациясы', text: 'Кенеттен болатын жүрек өлімінің алдын алу және жүрек жеткіліксіздігін емдеу.', duration: '1–1,5 сағат', stay: '5 күн' },
    ],
    conditions: ['Жүрекшелер фибрилляциясы және трепетаниесі', 'Қарыншаүстілік және қарыншалық тахикардиялар', 'WPW синдромы', 'II–III дәрежелі АВ-блокада', 'Синус түйінінің әлсіздік синдромы', 'Созылмалы жүрек жеткіліксіздігі'],
    technology: ['Криоабляция жүйесі', 'Carto 3', 'EnsiteX', 'Medtronic, Boston Scientific және Abbott құрылғылары', 'ЭКГ-ні тәуліктік мониторингілеу'],
  },
  gynecology: {
    summary: 'Бөлімшенің әйелдердің репродуктивті жүйесі ауруларын жоспарлы емдеуде көпжылдық тәжірибесі бар. Негізгі бағыттар — ағзаны сақтайтын, лапароскопиялық, қынаптық және реконструктивті операциялар, сондай-ақ қысқа оңалу мерзімі.',
    services: ['Лапароскопиялық миомэктомия', 'Эндометриоз және жабысқақ процесс кезіндегі операциялар', 'Гистероскопия және гистерорезектоскопия', 'Жатыр артерияларын эмболизациялау және радиожиілікті абляция', 'Жамбас түбін реконструкциялау', 'Стрестік несеп ұстамау кезіндегі TVT-O'],
    programs: [
      { name: 'Миоманы ағзаны сақтай отырып емдеу', text: 'Етеккір және репродуктивті функцияны сақтай отырып миома түйіндерін алып тастау.' },
      { name: 'Лапароскопиялық гинекологиялық хирургия', text: 'Эндометриоз, кисталар, жабысқақ процесс және түтіктік бедеулік кезінде операция жасау.' },
      { name: 'Жатырішілік хирургия', text: 'Полиптерді, субмукозды миоманы, синехияларды және жатырішілік пердені алып тастау.' },
      { name: 'Реконструктивті гинекология', text: 'Жамбас түбін қалпына келтіру және жамбас ағзаларының пролапсын емдеу.' },
    ],
    conditions: ['Жатыр миомасы', 'Эндометриоз', 'Аналық бездің қатерсіз түзілістері', 'Түтіктік-перитонеалдық бедеулік', 'Эндометрий және жатыр мойны өзегінің патологиясы', 'Жамбас ағзаларының пролапсы'],
    technology: ['Лапароскопиялық жабдық', 'Гистерорезектоскоп', 'Радиожиілікті абляция', 'Эндоваскулярлық эмболизация', 'TVT-O торлы жүйелері'],
  },
  'cardiac-surgery': {
    summary: 'Бөлімше жыл сайын ашық жүрекке 650-ден астам операция, соның ішінде күрделі және қайталама араласулар жасайды. Аз инвазивті технологиялар, жедел оңалту және операциядан кейінгі реабилитация дамытылуда.',
    services: ['Аортокоронарлық шунттау', 'MIDCAB / TCRAT аз инвазивті шунттауы', 'Жүрек қақпақшаларын пластикалау және протездеу', 'Аорта түбіріне, өрлеме бөлігі мен доғасына операциялар', 'Біріктірілген және қайталама операциялар', 'Жүрекшелер фибрилляциясын MAZE әдісімен хирургиялық емдеу'],
    programs: [
      { name: 'Аортокоронарлық шунттау', text: 'Көптамырлы зақымдану кезінде миокардты толық реваскуляризациялау.', duration: '2–4 сағат', stay: '7–10 күн' },
      { name: 'Аз инвазивті коронарлық шунттау', text: 'Төсті толық кеспей жасалатын және жылдам оңалуға мүмкіндік беретін операция.', duration: '2–4 сағат', stay: '5–7 күн' },
      { name: 'Қақпақшаларды пластикалау және протездеу', text: 'Пациенттің өз қақпақшасын реконструкциялау немесе заманауи протез орнату.', duration: '3–5 сағат', stay: '7–10 күн' },
      { name: 'Аорта хирургиясы', text: 'Аорта аневризмасы мен қатпарлануы кезінде күрделі реконструктивті операциялар.', duration: '5–8 сағат', stay: '10–14 күн' },
    ],
    conditions: ['Жүректің ишемиялық ауруы', 'Жүрек қақпақшаларының ақаулары', 'Аорта аневризмасы және қатпарлануы', 'Жүрекшелер фибрилляциясы', 'Ересектердегі туа біткен жүрек ақаулары', 'Сол жақ қарыншаның шығару фракциясының төмендеуі'],
    technology: ['Жасанды қан айналымы аппараттары', 'Миды қорғаудың заманауи әдістері', 'MICS аз инвазивті қолжетімділігі', 'Жедел оңалту хаттамалары'],
  },
  'heart-institute': {
    summary: 'ҰҒМО Жүрек институты кардиохирургияны, интервенциялық кардиологияны және аритмологияны бір орталықта біріктіреді. Шетелдік пациенттер құжаттарды қашықтан бағалаудан бастап емдеу мен оңалтуға дейін үйлестірілген толық медициналық көмек алады.',
    services: ['Кардиохирург, интервенциялық кардиолог және аритмолог консультациясы', 'ЭКГ, Холтер, эхокардиография, жүрек КТ және коронарография', 'Коронарлық шунттау және жүрек қақпақшаларына операциялар', 'Стенттеу, IVUS, OCT, FFR/iFR және CTO емдеу', 'Радиожиілікті және криоабляция', 'Кардиостимулятор, CRT және ICD имплантациясы', 'Кардиологиялық оңалту және Check-up бағдарламалары'],
    programs: [
      { name: 'Аз инвазивті коронарлық шунттау', text: 'Жұмыс істеп тұрған жүректе және шағын қолжетімділікпен миокардтың қанмен қамтылуын қалпына келтіру.', duration: '4–6 сағат', stay: '7–10 күн' },
      { name: 'Жүрек қақпақшаларының хирургиясы', text: 'Қақпақшаны пластикалау немесе заманауи протезбен алмастыру, мүмкіндік болса аз инвазивті әдіспен.', duration: '3–5 сағат', stay: '7–10 күн' },
      { name: 'Коронарлық артерияларды стенттеу', text: 'IVUS немесе OCT бақылауымен қан ағымын аз инвазивті қалпына келтіру.', duration: '30–90 минут', stay: '1–3 күн' },
      { name: 'Аритмияның катетерлік абляциясы', text: 'Жүрекшелер фибрилляциясы мен басқа тахикардияларды радиожиілік немесе криоәдіспен емдеу.', duration: '2–4 сағат', stay: '2–3 күн' },
      { name: 'Cardio Check-up', text: 'Мамандар қорытындысы және жеке жоспары бар жүрек-қан тамырлары қаупін кешенді бағалау.', duration: '1–3 күн', stay: 'Қажет емес' },
    ],
    conditions: ['Жүректің ишемиялық ауруы', 'Жүрек қақпақшаларының ақаулары', 'Жүрек ырғағының бұзылыстары', 'Аорта аневризмасы және қатпарлануы', 'Созылмалы жүрек жеткіліксіздігі', 'Ересектердегі туа біткен жүрек ақаулары'],
    technology: ['Сараптамалық эхокардиография және жүрек КТ', 'Ангиография, IVUS, OCT және FFR/iFR', '3D-навигация және криоабляция жүйелері', 'Жасанды қан айналымы аппараттары', 'Заманауи кардиостимуляторлар, CRT және ICD құрылғылары'],
  },
}

const contentFields = ['summary', 'services', 'programs', 'conditions', 'technology', 'journey', 'benefits']

const pickLocalizedContent = (department, language) => {
  const localized = localizeDepartment(department, language)
  return {
    title: localized.displayTitle,
    short: localized.displayShort,
    ...Object.fromEntries(contentFields.map((field) => [field, localized[field]])),
  }
}

export function createDefaultTreatmentDepartmentsForCms() {
  return TREATMENT_DEPARTMENTS.map((department, index) => ({
    slug: department.slug,
    icon: department.icon,
    accent: department.accent,
    heroImage: department.heroImage,
    sortOrder: index + 1,
    isActive: true,
    specialtyMatches: [...department.specialtyMatches],
    content: {
      ru: pickLocalizedContent(department, 'ru'),
      en: pickLocalizedContent(department, 'en'),
      kk: pickLocalizedContent(department, 'kk'),
    },
  }))
}

export function mergeTreatmentDepartments(cmsDepartments) {
  if (!Array.isArray(cmsDepartments) || cmsDepartments.length === 0) return TREATMENT_DEPARTMENTS

  const fallbackBySlug = new Map(TREATMENT_DEPARTMENTS.map((department) => [department.slug, department]))
  const storedBySlug = new Map(cmsDepartments.filter((item) => item?.slug).map((item) => [item.slug, item]))
  const merged = TREATMENT_DEPARTMENTS.map((fallback, index) => {
    const stored = storedBySlug.get(fallback.slug)
    return stored ? {
      ...fallback,
      ...stored,
      sortOrder: Number(stored.sortOrder) || index + 1,
      specialtyMatches: Array.isArray(stored.specialtyMatches) && stored.specialtyMatches.length > 0
        ? stored.specialtyMatches
        : fallback.specialtyMatches,
      content: stored.content || {},
    } : fallback
  })
  for (const stored of cmsDepartments) {
    if (stored?.slug && !fallbackBySlug.has(stored.slug)) {
      const baseContent = stored.content?.ru || {}
      merged.push({
        ...stored,
        title: stored.title || {
          ru: stored.content?.ru?.title || stored.slug,
          en: stored.content?.en?.title || stored.content?.ru?.title || stored.slug,
          kk: stored.content?.kk?.title || stored.content?.ru?.title || stored.slug,
        },
        short: stored.short || {
          ru: stored.content?.ru?.short || '',
          en: stored.content?.en?.short || stored.content?.ru?.short || '',
          kk: stored.content?.kk?.short || stored.content?.ru?.short || '',
        },
        summary: stored.summary || baseContent.summary || '',
        services: Array.isArray(stored.services) ? stored.services : (baseContent.services || []),
        programs: Array.isArray(stored.programs) ? stored.programs : (baseContent.programs || []),
        conditions: Array.isArray(stored.conditions) ? stored.conditions : (baseContent.conditions || []),
        technology: Array.isArray(stored.technology) ? stored.technology : (baseContent.technology || []),
        journey: Array.isArray(stored.journey) ? stored.journey : (baseContent.journey || []),
        benefits: Array.isArray(stored.benefits) ? stored.benefits : (baseContent.benefits || []),
      })
    }
  }
  return merged
    .filter((department) => department.isActive !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
}

export function getTreatmentDepartment(slug, departments = TREATMENT_DEPARTMENTS) {
  return departments.find((department) => department.slug === slug)
}

const specialtyAliases = {
  neurosurgery: ['neurologist', 'neurosurgeon', 'невролог', 'нейрохирург'],
  therapy: ['internist', 'internal medicine', 'endocrinologist', 'gastroenterologist', 'rheumatologist', 'pulmonologist', 'hematologist', 'nephrologist', 'терапевт', 'эндокринолог', 'гастроэнтеролог', 'ревматолог', 'пульмонолог', 'гематолог', 'нефролог'],
  urology: ['urologist', 'andrologist', 'уролог', 'андролог'],
  'general-thoracic-surgery': ['general surgeon', 'thoracic surgeon', 'oncologist', 'colorectal surgeon', 'хирург', 'торакальный хирург', 'онколог', 'колопроктолог'],
  'interventional-cardiology': ['cardiologist', 'interventional cardiologist', 'кардиолог', 'интервенционный кардиолог'],
  arrhythmology: ['cardiologist', 'arrhythmologist', 'electrophysiologist', 'кардиолог', 'аритмолог'],
  gynecology: ['gynecologist', 'obstetrician-gynecologist', 'гинеколог', 'акушер-гинеколог'],
  'cardiac-surgery': ['cardiologist', 'cardiac surgeon', 'cardiothoracic surgeon', 'кардиолог', 'кардиохирург'],
  'heart-institute': ['cardiologist', 'cardiac surgeon', 'interventional cardiologist', 'arrhythmologist', 'кардиолог', 'кардиохирург', 'интервенционный кардиолог', 'аритмолог'],
}

const normalizeMatchValue = (value) => String(value || '')
  .toLocaleLowerCase('ru')
  .replace(/ё/g, 'е')
  .replace(/[–—]/g, '-')
  .trim()

export function doctorBelongsToTreatmentDepartment(doctor, department) {
  if (!doctor || !department) return false
  if (doctor.isActive === false) return false

  if (Array.isArray(doctor.treatmentDepartments) && doctor.treatmentDepartments.length > 0) {
    return doctor.treatmentDepartments.includes(department.slug)
  }

  const specialization = doctor.specialization || {}
  const names = [specialization.name, specialization.nameEn, specialization.nameKk]
    .map(normalizeMatchValue)
    .filter(Boolean)
  const matches = [...(department.specialtyMatches || []), ...(specialtyAliases[department.slug] || [])]
    .map(normalizeMatchValue)
    .filter(Boolean)

  return matches.some((match) => names.some((name) => name.includes(match) || match.includes(name)))
}

export function localizeDepartment(department, language = 'ru') {
  if (!department) return null
  const storedContent = department.content?.[language]
  const staticContent = language === 'en' ? EN_CONTENT[department.slug] : language === 'kk' ? KK_CONTENT[department.slug] : null
  const baseContent = {
    summary: department.summary,
    services: department.services,
    programs: department.programs,
    conditions: department.conditions,
    technology: department.technology,
  }
  const localizedContent = { ...baseContent, ...(staticContent || {}), ...(storedContent || {}) }
  return {
    ...department,
    ...(localizedContent || {}),
    journey: localizedContent?.journey || (language === 'en' ? commonJourneyEn : language === 'kk' ? commonJourneyKk : department.journey),
    benefits: localizedContent?.benefits || (language === 'en' ? commonBenefitsEn : language === 'kk' ? commonBenefitsKk : department.benefits),
    displayTitle: localizedContent?.title || department.title?.[language] || department.title?.ru || department.slug,
    displayShort: localizedContent?.short || department.short?.[language] || department.short?.ru || '',
  }
}
