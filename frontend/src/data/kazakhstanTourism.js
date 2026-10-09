import { getMediaUrl } from '../services/api'

export const tourismPageCopy = {
  ru: {
    heroBadge: 'Туризм в Казахстане',
    heroTitle: 'Казахстан: степь, горы, древние города и современная Азия',
    heroText:
      'Большая страна на перекрестке Европы и Азии: здесь можно совместить лечение, отдых, историю Великого шелкового пути, национальные парки и городские маршруты.',
    heroCta: 'Смотреть регионы',
    secondaryCta: 'История и культура',
    quickFacts: [
      { value: '20', label: 'регионов и городов республиканского значения' },
      { value: '5', label: 'природных поясов от пустынь до ледников' },
      { value: '4', label: 'сезона для разных форматов путешествий' },
    ],
    subnav: {
      overview: 'О Казахстане',
      history: 'История',
      regions: 'Регионы',
    },
    overviewBadge: 'Общее знакомство',
    overviewTitle: 'Что важно знать перед поездкой',
    overviewText:
      'Казахстан подходит для спокойного восстановления после лечения, семейного отдыха, активных маршрутов и культурных поездок. Туристическая логистика строится вокруг крупных городов, а дальше маршрут можно расширять по регионам.',
    overviewCards: [
      {
        title: 'География',
        text: 'Степи, пустыни, каньоны, озера, горные ущелья и хвойные леса позволяют собрать маршрут под любой темп.',
      },
      {
        title: 'Города',
        text: 'Астана, Алматы и Шымкент удобны как точки прибытия, отдыха, деловых встреч и коротких экскурсионных программ.',
      },
      {
        title: 'Культура',
        text: 'Казахская кочевая традиция, музыка, кухня, ремесла и гостеприимство хорошо сочетаются с современным городским сервисом.',
      },
    ],
    historyBadge: 'Исторический контекст',
    historyTitle: 'От Великой степи до современного Казахстана',
    historyIntro:
      'История страны читается через археологические памятники, мавзолеи, караванные пути, советское наследие, космодром и новую архитектуру.',
    historyItems: [
      {
        period: 'Древняя степь',
        title: 'Саки, курганы и ранние кочевые культуры',
        text: 'Археологические маршруты показывают, как формировалась культура Великой степи, металлургия, коневодство и символика древних племен.',
      },
      {
        period: 'Шелковый путь',
        title: 'Города, караваны и мавзолеи',
        text: 'Юг Казахстана был частью торговых путей: Туркестан, Отрар и Тараз остаются главными точками исторического туризма.',
      },
      {
        period: 'XX век',
        title: 'Космос, индустрия и городская модернизация',
        text: 'Байконур, Караганда, Алматы и новая Астана показывают разные эпохи развития страны и ее роль в Евразии.',
      },
    ],
    regionsBadge: 'Маршруты по регионам',
    regionsTitle: 'Куда поехать и какой туризм выбрать',
    regionsText:
      'Региональные карточки можно расширять: добавлять сезоны, отели, клиники, трансферы, готовые туры и отдельные посадочные страницы.',
    allTypes: 'Все направления',
    centerLabel: 'Центр',
    highlightsLabel: 'Что посмотреть',
  },
  en: {
    heroBadge: 'Tourism in Kazakhstan',
    heroTitle: 'Kazakhstan: steppe, mountains, ancient cities and modern Asia',
    heroText:
      'A large country between Europe and Asia where medical travel can be combined with recovery, Silk Road history, national parks and city routes.',
    heroCta: 'Explore regions',
    secondaryCta: 'History and culture',
    quickFacts: [
      { value: '20', label: 'regions and major cities' },
      { value: '5', label: 'landscape zones from deserts to glaciers' },
      { value: '4', label: 'seasons for different travel formats' },
    ],
    subnav: { overview: 'About Kazakhstan', history: 'History', regions: 'Regions' },
    overviewBadge: 'General overview',
    overviewTitle: 'What to know before travelling',
    overviewText:
      'Kazakhstan works well for calm recovery, family travel, active routes and cultural trips. Most itineraries start in major cities and expand into nearby regions.',
    overviewCards: [
      { title: 'Geography', text: 'Steppe, deserts, canyons, lakes, mountain gorges and forests make it easy to match a route to any pace.' },
      { title: 'Cities', text: 'Astana, Almaty and Shymkent are convenient arrival points for rest, meetings and short excursion programs.' },
      { title: 'Culture', text: 'Nomadic heritage, music, cuisine, crafts and hospitality pair naturally with modern city services.' },
    ],
    historyBadge: 'Historical context',
    historyTitle: 'From the Great Steppe to modern Kazakhstan',
    historyIntro:
      'The country’s story can be explored through archaeology, mausoleums, caravan routes, Soviet heritage, Baikonur and new architecture.',
    historyItems: [
      { period: 'Ancient steppe', title: 'Saka culture, burial mounds and early nomads', text: 'Archaeological sites show the development of steppe culture, metallurgy and horse traditions.' },
      { period: 'Silk Road', title: 'Cities, caravans and mausoleums', text: 'Southern Kazakhstan was part of historic trade routes, with Turkistan, Otrar and Taraz as key destinations.' },
      { period: '20th century', title: 'Space, industry and urban modernization', text: 'Baikonur, Karaganda, Almaty and Astana represent different stages of Kazakhstan’s development.' },
    ],
    regionsBadge: 'Regional routes',
    regionsTitle: 'Where to go and what tourism to choose',
    regionsText:
      'The regional structure is ready to scale with seasons, hotels, clinics, transfers, packaged tours and dedicated landing pages.',
    allTypes: 'All directions',
    centerLabel: 'Center',
    highlightsLabel: 'Highlights',
  },
  kk: {
    heroBadge: 'Қазақстандағы туризм',
    heroTitle: 'Қазақстан: дала, таулар, көне қалалар және заманауи Азия',
    heroText:
      'Еуропа мен Азия тоғысындағы елде емделуді демалыспен, Ұлы Жібек жолы тарихымен, ұлттық парктермен және қалалық маршруттармен біріктіруге болады.',
    heroCta: 'Аймақтарды көру',
    secondaryCta: 'Тарих және мәдениет',
    quickFacts: [
      { value: '20', label: 'аймақ және республикалық маңызы бар қала' },
      { value: '5', label: 'шөлден мұздыққа дейінгі табиғи белдеу' },
      { value: '4', label: 'әртүрлі саяхатқа арналған маусым' },
    ],
    subnav: { overview: 'Қазақстан туралы', history: 'Тарих', regions: 'Аймақтар' },
    overviewBadge: 'Жалпы танысу',
    overviewTitle: 'Сапар алдында білу керек',
    overviewText:
      'Қазақстан емнен кейін тынығуға, отбасылық демалысқа, белсенді маршруттарға және мәдени саяхаттарға қолайлы.',
    overviewCards: [
      { title: 'География', text: 'Дала, шөл, шатқал, көл, тау аңғары және орман кез келген қарқынға сай маршрут құруға мүмкіндік береді.' },
      { title: 'Қалалар', text: 'Астана, Алматы және Шымкент келу, демалу және қысқа экскурсиялар үшін ыңғайлы.' },
      { title: 'Мәдениет', text: 'Көшпелі мұра, музыка, ас, қолөнер және қонақжайлық заманауи сервистермен үйлеседі.' },
    ],
    historyBadge: 'Тарихи контекст',
    historyTitle: 'Ұлы даладан заманауи Қазақстанға дейін',
    historyIntro:
      'Ел тарихын археология, кесенелер, керуен жолдары, кеңестік мұра, Байқоңыр және жаңа сәулет арқылы тануға болады.',
    historyItems: [
      { period: 'Ежелгі дала', title: 'Сақтар, қорғандар және көшпелі мәдениет', text: 'Археологиялық орындар дала мәдениетінің, металлургияның және жылқы дәстүрінің дамуын көрсетеді.' },
      { period: 'Жібек жолы', title: 'Қалалар, керуендер және кесенелер', text: 'Оңтүстік Қазақстан тарихи сауда жолдарының бір бөлігі болды.' },
      { period: 'XX ғасыр', title: 'Ғарыш, индустрия және қалалық жаңару', text: 'Байқоңыр, Қарағанды, Алматы және Астана ел дамуының әр кезеңін көрсетеді.' },
    ],
    regionsBadge: 'Аймақтық маршруттар',
    regionsTitle: 'Қайда бару және қандай туризм таңдау керек',
    regionsText:
      'Аймақтық құрылым кейін маусым, қонақүй, клиника, трансфер, дайын тур және жеке беттермен кеңейтуге дайын.',
    allTypes: 'Барлық бағыттар',
    centerLabel: 'Орталығы',
    highlightsLabel: 'Көруге болады',
  },
}

export const tourismTypes = {
  city: { ru: 'Городской', en: 'City', kk: 'Қалалық' },
  nature: { ru: 'Природа', en: 'Nature', kk: 'Табиғат' },
  mountains: { ru: 'Горы', en: 'Mountains', kk: 'Тау' },
  culture: { ru: 'Культура', en: 'Culture', kk: 'Мәдениет' },
  history: { ru: 'История', en: 'History', kk: 'Тарих' },
  sacred: { ru: 'Сакральный', en: 'Sacred', kk: 'Киелі' },
  wellness: { ru: 'Wellness', en: 'Wellness', kk: 'Wellness' },
  beach: { ru: 'Пляжный', en: 'Beach', kk: 'Жағажай' },
  adventure: { ru: 'Активный', en: 'Adventure', kk: 'Белсенді' },
  eco: { ru: 'Эко', en: 'Eco', kk: 'Эко' },
  gastronomy: { ru: 'Гастро', en: 'Gastro', kk: 'Гастро' },
  space: { ru: 'Космос', en: 'Space', kk: 'Ғарыш' },
}

// Места и регионы для страницы «Туризм». Админ правит их в разделе
// «Туризм» (Global.tourismRegions); этот список — значения по умолчанию и
// запасной вариант, пока в CMS ничего не сохранено.
const region = (id, image, types, ru, en, kk) => ({
  id,
  image,
  types,
  isActive: true,
  content: {
    ru: { name: ru[0], center: ru[1], summary: ru[2], highlights: ru[3] },
    en: { name: en[0], center: en[1], summary: en[2], highlights: en[3] },
    kk: { name: kk[0], center: kk[1], summary: kk[2], highlights: kk[3] },
  },
})

export const tourismRegions = [
  region('astana', '/tourism/astana.jpg', ['city', 'culture'],
    ['Астана', 'Астана', 'Столица с современной архитектурой, музеями, набережной, театрами и удобной базой для коротких экскурсий.', ['Байтерек и бульвар Нуржол', 'Национальный музей', 'EXPO и современная архитектура']],
    ['Astana', 'Astana', 'The capital, with contemporary architecture, museums, a riverside promenade, theatres and a convenient base for short excursions.', ['Baiterek and Nurzhol Boulevard', 'National Museum', 'EXPO and modern architecture']],
    ['Астана', 'Астана', 'Заманауи сәулеті, музейлері, жағалауы, театрлары бар және қысқа экскурсияларға ыңғайлы елорда.', ['Бәйтерек және Нұржол бульвары', 'Ұлттық музей', 'EXPO және заманауи сәулет']]),
  region('almaty-city', '/tourism/almaty.jpg', ['city', 'mountains', 'gastronomy'],
    ['Алматы', 'Алматы', 'Самый удобный город для сочетания городской культуры, ресторанов, горных маршрутов и однодневных поездок.', ['Кок-Тобе и Медеу', 'Шымбулак', 'Музеи, рынки и гастрономия']],
    ['Almaty', 'Almaty', 'The easiest city for combining urban culture, restaurants, mountain routes and day trips.', ['Kok-Tobe and Medeu', 'Shymbulak', 'Museums, markets and food']],
    ['Алматы', 'Алматы', 'Қала мәдениетін, мейрамханаларды, тау маршруттарын және бір күндік сапарларды үйлестіруге ең ыңғайлы қала.', ['Көктөбе және Медеу', 'Шымбұлақ', 'Музейлер, базарлар және гастрономия']]),
  region('shymkent', '/tourism/turkistan.jpg', ['city', 'culture', 'gastronomy'],
    ['Шымкент', 'Шымкент', 'Южный мегаполис с теплым климатом, базарами, кухней и быстрым доступом к Туркестану и природным маршрутам.', ['Старый город и цитадель', 'Южная кухня', 'Маршруты в Сайрам-Угам']],
    ['Shymkent', 'Shymkent', 'A southern metropolis with a warm climate, bazaars, great food and quick access to Turkistan and nature routes.', ['Old town and citadel', 'Southern cuisine', 'Routes to Sairam-Ugam']],
    ['Шымкент', 'Шымкент', 'Жылы климаты, базарлары, асханасы бар және Түркістан мен табиғи маршруттарға жақын оңтүстік мегаполис.', ['Ескі қала және цитадель', 'Оңтүстік асханасы', 'Сайрам-Өгем бағыттары']]),
  region('akmola', '/tourism/burabay.jpg', ['nature', 'wellness', 'eco'],
    ['Акмолинская область', 'Кокшетау', 'Курортная зона Бурабай, озера, сосновые леса и санаторный отдых рядом со столицей.', ['Бурабай и Щучье', 'Окжетпес', 'Зеренда и лесные озера']],
    ['Akmola Region', 'Kokshetau', 'The Burabay resort area, lakes, pine forests and sanatorium stays close to the capital.', ['Burabay and Shchuchye', 'Okzhetpes', 'Zerenda and forest lakes']],
    ['Ақмола облысы', 'Көкшетау', 'Бурабай курорттық аймағы, көлдер, қарағайлы ормандар және елорда маңындағы шипажай демалысы.', ['Бурабай және Щучье', 'Оқжетпес', 'Зеренді және орман көлдері']]),
  region('aktobe', '/tourism/baikonur.jpg', ['nature', 'adventure', 'history'],
    ['Актюбинская область', 'Актобе', 'Западные степи, меловые плато, речные долины и маршруты для тех, кто любит редкие природные ландшафты.', ['Мугалжарские горы', 'Каргалинское водохранилище', 'Степные экспедиции']],
    ['Aktobe Region', 'Aktobe', 'Western steppes, chalk plateaus, river valleys and routes for lovers of rare landscapes.', ['Mugalzhar Mountains', 'Kargaly Reservoir', 'Steppe expeditions']],
    ['Ақтөбе облысы', 'Ақтөбе', 'Батыс даласы, бор үстірттері, өзен аңғарлары және сирек табиғат көрінісін сүйетіндерге арналған маршруттар.', ['Мұғалжар таулары', 'Қарғалы су қоймасы', 'Дала экспедициялары']]),
  region('almaty-region', '/tourism/charyn.jpg', ['nature', 'mountains', 'adventure', 'beach'],
    ['Алматинская область', 'Конаев', 'Один из самых сильных туристических регионов: каньоны, озера, горы, пляжный отдых и фотомаршруты.', ['Чарынский каньон', 'Кольсай и Каинды', 'Капчагайское водохранилище']],
    ['Almaty Region', 'Konaev', 'One of the strongest tourism regions: canyons, lakes, mountains, beach holidays and photo routes.', ['Charyn Canyon', 'Kolsai and Kaindy lakes', 'Kapchagay Reservoir']],
    ['Алматы облысы', 'Қонаев', 'Ең мықты туристік аймақтардың бірі: шатқалдар, көлдер, таулар, жағажай демалысы және фотомаршруттар.', ['Шарын шатқалы', 'Көлсай және Қайыңды', 'Қапшағай су қоймасы']]),
  region('atyrau', '/tourism/mangystau.jpg', ['nature', 'history', 'eco'],
    ['Атырауская область', 'Атырау', 'Каспийский регион, дельта Урала, степные ландшафты и символическая граница Европы и Азии.', ['Мост Европа-Азия', 'Дельта реки Урал', 'Сарайшык']],
    ['Atyrau Region', 'Atyrau', 'The Caspian region with the Ural delta, steppe landscapes and the symbolic border between Europe and Asia.', ['Europe–Asia bridge', 'Ural River delta', 'Saraishyk']],
    ['Атырау облысы', 'Атырау', 'Каспий өңірі, Жайық атырауы, дала көріністері және Еуропа мен Азияның символдық шекарасы.', ['Еуропа–Азия көпірі', 'Жайық өзенінің атырауы', 'Сарайшық']]),
  region('east-kazakhstan', '/tourism/altai.jpg', ['mountains', 'nature', 'eco', 'adventure'],
    ['Восточно-Казахстанская область', 'Усть-Каменогорск', 'Алтай, горные озера, леса, мараловодческие хозяйства и насыщенные природные маршруты.', ['Риддер и Западный Алтай', 'Бухтарминское водохранилище', 'Катон-Карагай']],
    ['East Kazakhstan Region', 'Oskemen', 'Altai, mountain lakes, forests, maral deer farms and rich nature routes.', ['Ridder and Western Altai', 'Bukhtarma Reservoir', 'Katon-Karagay']],
    ['Шығыс Қазақстан облысы', 'Өскемен', 'Алтай, тау көлдері, ормандар, марал шаруашылықтары және мазмұнды табиғи маршруттар.', ['Риддер және Батыс Алтай', 'Бұқтырма су қоймасы', 'Катонқарағай']]),
  region('zhambyl', '/tourism/turkistan.jpg', ['history', 'culture', 'nature'],
    ['Жамбылская область', 'Тараз', 'Один из центров древней истории: Тараз, мавзолеи, археология и природные ущелья.', ['Древний Тараз', 'Мавзолеи Айша-Биби и Бабаджа-Хатун', 'Аксу-Жабаглы рядом с регионом']],
    ['Zhambyl Region', 'Taraz', 'A centre of ancient history: Taraz, mausoleums, archaeology and natural gorges.', ['Ancient Taraz', 'Aisha Bibi and Babaji Khatun mausoleums', 'Aksu-Zhabagly nearby']],
    ['Жамбыл облысы', 'Тараз', 'Көне тарихтың орталықтарының бірі: Тараз, кесенелер, археология және табиғи шатқалдар.', ['Көне Тараз', 'Айша бибі мен Бабаджы қатын кесенелері', 'Ақсу-Жабағылы жақын маңда']]),
  region('zhetysu', '/tourism/charyn.jpg', ['nature', 'mountains', 'eco', 'adventure'],
    ['Область Жетысу', 'Талдыкорган', 'Семиречье с горными долинами, озером Алаколь, Джунгарским Алатау и мягкими природными маршрутами.', ['Алаколь', 'Джунгарский Алатау', 'Водопады и горные ущелья']],
    ['Zhetysu Region', 'Taldykorgan', 'The Seven Rivers land with mountain valleys, Lake Alakol, the Dzungarian Alatau and gentle nature routes.', ['Lake Alakol', 'Dzungarian Alatau', 'Waterfalls and mountain gorges']],
    ['Жетісу облысы', 'Талдықорған', 'Тау аңғарлары, Алакөл, Жоңғар Алатауы және жайлы табиғи маршруттары бар Жетісу.', ['Алакөл', 'Жоңғар Алатауы', 'Сарқырамалар мен тау шатқалдары']]),
  region('west-kazakhstan', '/tourism/baikonur.jpg', ['history', 'nature', 'culture'],
    ['Западно-Казахстанская область', 'Уральск', 'Исторический Уральск, река Жайык, купеческая архитектура и спокойные маршруты западной степи.', ['Старый Уральск', 'Река Жайык', 'Исторические музеи']],
    ['West Kazakhstan Region', 'Oral', 'Historic Oral, the Zhaiyk River, merchant architecture and calm routes across the western steppe.', ['Old Oral', 'Zhaiyk River', 'History museums']],
    ['Батыс Қазақстан облысы', 'Орал', 'Тарихи Орал, Жайық өзені, көпес сәулеті және батыс даласының жайлы маршруттары.', ['Ескі Орал', 'Жайық өзені', 'Тарихи музейлер']]),
  region('karaganda', '/tourism/baikonur.jpg', ['history', 'nature', 'city'],
    ['Карагандинская область', 'Караганда', 'Индустриальная история, КарЛаг, степные озера и путь к природным зонам Центрального Казахстана.', ['Музей КарЛага', 'Каркаралинск', 'Балхашское направление']],
    ['Karaganda Region', 'Karaganda', 'Industrial history, the KarLag memorial, steppe lakes and the way into Central Kazakhstan’s nature.', ['KarLag Museum', 'Karkaraly', 'Lake Balkhash routes']],
    ['Қарағанды облысы', 'Қарағанды', 'Индустриялық тарих, ҚарЛаг, дала көлдері және Орталық Қазақстан табиғатына апаратын жол.', ['ҚарЛаг музейі', 'Қарқаралы', 'Балқаш бағыты']]),
  region('kostanay', '/tourism/burabay.jpg', ['eco', 'nature', 'history'],
    ['Костанайская область', 'Костанай', 'Северные степи, заповедные территории, озера и маршруты для наблюдения за природой.', ['Наурзумский заповедник', 'Озера и степные ландшафты', 'Костанайская архитектура']],
    ['Kostanay Region', 'Kostanay', 'Northern steppes, nature reserves, lakes and wildlife-watching routes.', ['Naurzum Nature Reserve', 'Lakes and steppe landscapes', 'Kostanay architecture']],
    ['Қостанай облысы', 'Қостанай', 'Солтүстік даласы, қорық аумақтары, көлдер және табиғатты бақылау маршруттары.', ['Наурызым қорығы', 'Көлдер мен дала көріністері', 'Қостанай сәулеті']]),
  region('kyzylorda', '/tourism/baikonur.jpg', ['space', 'history', 'adventure'],
    ['Кызылординская область', 'Кызылорда', 'Байконур, Сырдарья, наследие древних городищ и маршруты к Аральскому морю.', ['Байконур', 'Коркыт Ата', 'Аральское море']],
    ['Kyzylorda Region', 'Kyzylorda', 'Baikonur, the Syr Darya, ancient settlements and routes to the Aral Sea.', ['Baikonur', 'Korkyt Ata memorial', 'Aral Sea']],
    ['Қызылорда облысы', 'Қызылорда', 'Байқоңыр, Сырдария, көне қалашықтар мұрасы және Арал теңізіне апаратын маршруттар.', ['Байқоңыр', 'Қорқыт Ата', 'Арал теңізі']]),
  region('mangystau', '/tourism/mangystau.jpg', ['adventure', 'sacred', 'beach', 'nature'],
    ['Мангистауская область', 'Актау', 'Каспийское море, пустынные каньоны, подземные мечети и один из самых фотогеничных регионов страны.', ['Бозжыра', 'Шерқала', 'Каспийское побережье и подземные мечети']],
    ['Mangystau Region', 'Aktau', 'The Caspian Sea, desert canyons, underground mosques and one of the most photogenic regions in the country.', ['Bozzhyra', 'Sherkala', 'Caspian coast and underground mosques']],
    ['Маңғыстау облысы', 'Ақтау', 'Каспий теңізі, шөл шатқалдары, жерасты мешіттері және елдегі ең көрікті аймақтардың бірі.', ['Бозжыра', 'Шерқала', 'Каспий жағалауы және жерасты мешіттері']]),
  region('pavlodar', '/tourism/bayanaul.webp', ['nature', 'wellness', 'history'],
    ['Павлодарская область', 'Павлодар', 'Баянаул, озера, скальные массивы и спокойный санаторно-природный отдых на северо-востоке.', ['Баянаульский национальный парк', 'Озеро Жасыбай', 'Павлодарская набережная']],
    ['Pavlodar Region', 'Pavlodar', 'Bayanaul, lakes, rock formations and calm sanatorium and nature stays in the north-east.', ['Bayanaul National Park', 'Lake Zhasybay', 'Pavlodar riverside']],
    ['Павлодар облысы', 'Павлодар', 'Баянауыл, көлдер, жартастар және солтүстік-шығыстағы жайлы шипажай-табиғат демалысы.', ['Баянауыл ұлттық паркі', 'Жасыбай көлі', 'Павлодар жағалауы']]),
  region('north-kazakhstan', '/tourism/burabay.jpg', ['nature', 'eco', 'history'],
    ['Северо-Казахстанская область', 'Петропавловск', 'Леса, озера, северная архитектура и мягкие маршруты для спокойного отдыха.', ['Имантау-Шалкарская зона', 'Петропавловск', 'Озерный отдых']],
    ['North Kazakhstan Region', 'Petropavl', 'Forests, lakes, northern architecture and gentle routes for a calm holiday.', ['Imantau-Shalkar area', 'Petropavl', 'Lakeside rest']],
    ['Солтүстік Қазақстан облысы', 'Петропавл', 'Ормандар, көлдер, солтүстік сәулеті және тыныш демалысқа арналған жайлы маршруттар.', ['Имантау-Шалқар аймағы', 'Петропавл', 'Көл жағасындағы демалыс']]),
  region('turkistan', '/tourism/turkistan.jpg', ['sacred', 'history', 'culture', 'nature'],
    ['Туркестанская область', 'Туркестан', 'Главное направление сакрального и исторического туризма: мавзолеи, древние города и южные природные парки.', ['Мавзолей Ходжи Ахмеда Ясави', 'Отрар', 'Сауран и Каратау']],
    ['Turkistan Region', 'Turkistan', 'The main destination for sacred and historical tourism: mausoleums, ancient cities and southern nature parks.', ['Mausoleum of Khoja Ahmed Yasawi', 'Otrar', 'Sauran and Karatau']],
    ['Түркістан облысы', 'Түркістан', 'Киелі және тарихи туризмнің басты бағыты: кесенелер, көне қалалар және оңтүстік табиғи парктері.', ['Қожа Ахмет Ясауи кесенесі', 'Отырар', 'Сауран және Қаратау']]),
  region('ulytau', '/tourism/baikonur.jpg', ['history', 'sacred', 'nature'],
    ['Область Улытау', 'Жезказган', 'Сердце Великой степи: горы Улытау, мавзолеи, исторические места и маршруты к наследию кочевых государств.', ['Горы Улытау', 'Жошы хан', 'Алаша хан']],
    ['Ulytau Region', 'Zhezkazgan', 'The heart of the Great Steppe: the Ulytau mountains, mausoleums, historic sites and the heritage of nomadic states.', ['Ulytau Mountains', 'Jochi Khan mausoleum', 'Alasha Khan mausoleum']],
    ['Ұлытау облысы', 'Жезқазған', 'Ұлы даланың жүрегі: Ұлытау таулары, кесенелер, тарихи орындар және көшпелі мемлекеттер мұрасы.', ['Ұлытау таулары', 'Жошы хан', 'Алаша хан']]),
  region('abai', '/tourism/altai.jpg', ['culture', 'history', 'nature'],
    ['Область Абай', 'Семей', 'Литературное наследие Абая, история Семея, Алаш и природные маршруты восточной степи.', ['Музей Абая', 'Семей и мост через Иртыш', 'Жидебай']],
    ['Abai Region', 'Semey', 'Abai’s literary heritage, the history of Semey and Alash, and nature routes across the eastern steppe.', ['Abai Museum', 'Semey and the Irtysh bridge', 'Zhidebay']],
    ['Абай облысы', 'Семей', 'Абайдың әдеби мұрасы, Семей мен Алаш тарихы және шығыс даласының табиғи маршруттары.', ['Абай музейі', 'Семей және Ертіс көпірі', 'Жидебай']]),
].map((item, index) => ({ ...item, sortOrder: index + 1 }))

export const TOURISM_LOCALES = ['ru', 'en', 'kk']

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Регион на языке посетителя; пустые поля перевода берутся из русского. */
export function localizeTourismRegion(item, language = 'ru') {
  const lang = TOURISM_LOCALES.includes(language) ? language : 'ru'
  const ru = item?.content?.ru || {}
  const local = item?.content?.[lang] || {}
  const highlights = (Array.isArray(local.highlights) && local.highlights.some((line) => String(line).trim()))
    ? local.highlights
    : (Array.isArray(ru.highlights) ? ru.highlights : [])
  return {
    ...item,
    name: String(local.name || '').trim() || ru.name || item?.id || '',
    center: String(local.center || '').trim() || ru.center || '',
    summary: String(local.summary || '').trim() || ru.summary || '',
    highlights: highlights.map((line) => String(line).trim()).filter(Boolean),
  }
}

/**
 * Сохранённые в CMS места по порядку. Встроенный список — только пока в CMS
 * ничего не сохраняли: если админ удалил все места, страница пустая, а не
 * возвращает удалённые.
 */
export function resolveTourismRegions(stored) {
  const source = Array.isArray(stored) ? stored : tourismRegions
  return source
    .filter((item) => isPlainObject(item) && item.id)
    .map((item, index) => ({
      ...item,
      types: Array.isArray(item.types) ? item.types.filter((type) => tourismTypes[type]) : [],
      sortOrder: Number(item.sortOrder) || index + 1,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Картинки по умолчанию лежат во frontend/public, загруженные — в Strapi. */
export function resolveTourismImage(image) {
  const url = typeof image === 'string' ? image : image?.url
  if (typeof url === 'string' && (url.startsWith('/tourism/') || url.startsWith('/treatments/'))) return url
  return getMediaUrl(image) || ''
}
