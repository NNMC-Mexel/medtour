// Иконки специализаций: один реестр для сайта и для выбора в админке.
//
// В `specialization.icon` хранится ключ из этого списка. Часть старых записей
// содержит ключи, которые лендинг трактовал по-своему (`activity` у
// эндокринолога показывался щитовидкой, а без названия — желудком).
// Такие ключи в реестр намеренно не входят: для них, как и раньше, иконка
// берётся по названию специализации, и вид существующих карточек не меняется.
// Ключ, выбранный в админке, всегда из реестра и применяется как есть.
import {
  Accessibility,
  Activity,
  Ambulance,
  Apple,
  Baby,
  Bandage,
  Bone,
  Brain,
  BrainCog,
  createLucideIcon,
  Dna,
  Droplets,
  Ear,
  Eye,
  Fingerprint,
  Footprints,
  HandHeart,
  HeartPulse,
  Hospital,
  Mars,
  Microscope,
  Pill,
  Radiation,
  Ribbon,
  ScanFace,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube,
  Thermometer,
  Venus,
  Wind,
} from 'lucide-react'

export const StomachIcon = createLucideIcon('Stomach', [
  ['path', { d: 'M7 2v6.4c0 1.7-.8 3.2-2.2 4.2A5.1 5.1 0 0 0 8 22h2c5 0 9-3.4 9-8 0-3.4-2-5.6-5.1-6.7A3 3 0 0 1 12 4.5V2', key: 'stomach-body' }],
  ['path', { d: 'M7 8.5c1.4 1 3.2 1.2 4.8.5', key: 'stomach-fold' }],
])

export const ThyroidIcon = createLucideIcon('Thyroid', [
  ['path', { d: 'M10.2 8.3C8.8 5.4 6.8 3.8 5 4.3c-1.8.5-2.5 2.8-1.6 4.9.8 1.9 2.6 2.9 5.2 2.9', key: 'thyroid-left' }],
  ['path', { d: 'M13.8 8.3c1.4-2.9 3.4-4.5 5.2-4 1.8.5 2.5 2.8 1.6 4.9-.8 1.9-2.6 2.9-5.2 2.9', key: 'thyroid-right' }],
  ['path', { d: 'M9 11.5c0 5.4 1.1 8.5 3 8.5s3-3.1 3-8.5', key: 'thyroid-center' }],
])

export const SPECIALIZATION_ICONS = [
  { key: 'stethoscope', Icon: Stethoscope, label: { ru: 'Терапия', kk: 'Терапия', en: 'General practice' } },
  { key: 'heart', Icon: HeartPulse, label: { ru: 'Сердце', kk: 'Жүрек', en: 'Heart' } },
  { key: 'brain', Icon: Brain, label: { ru: 'Неврология', kk: 'Неврология', en: 'Neurology' } },
  { key: 'psychology', Icon: BrainCog, label: { ru: 'Психотерапия', kk: 'Психотерапия', en: 'Psychotherapy' } },
  { key: 'smile', Icon: Smile, label: { ru: 'Психология', kk: 'Психология', en: 'Psychology' } },
  { key: 'eye', Icon: Eye, label: { ru: 'Глаза', kk: 'Көз', en: 'Eyes' } },
  { key: 'ear', Icon: Ear, label: { ru: 'ЛОР', kk: 'ЛОР', en: 'ENT' } },
  { key: 'stomach', Icon: StomachIcon, label: { ru: 'Желудок', kk: 'Асқазан', en: 'Stomach' } },
  { key: 'thyroid', Icon: ThyroidIcon, label: { ru: 'Щитовидная железа', kk: 'Қалқанша без', en: 'Thyroid' } },
  { key: 'kidney', Icon: Droplets, label: { ru: 'Урология', kk: 'Урология', en: 'Urology' } },
  { key: 'female', Icon: Venus, label: { ru: 'Гинекология', kk: 'Гинекология', en: 'Gynecology' } },
  { key: 'mars', Icon: Mars, label: { ru: 'Андрология', kk: 'Андрология', en: 'Andrology' } },
  { key: 'baby', Icon: Baby, label: { ru: 'Педиатрия', kk: 'Педиатрия', en: 'Pediatrics' } },
  { key: 'skin', Icon: ScanFace, label: { ru: 'Кожа', kk: 'Тері', en: 'Skin' } },
  { key: 'sparkles', Icon: Sparkles, label: { ru: 'Косметология', kk: 'Косметология', en: 'Cosmetology' } },
  { key: 'scissors', Icon: Scissors, label: { ru: 'Хирургия', kk: 'Хирургия', en: 'Surgery' } },
  { key: 'bone', Icon: Bone, label: { ru: 'Ортопедия', kk: 'Ортопедия', en: 'Orthopedics' } },
  { key: 'footprints', Icon: Footprints, label: { ru: 'Стопа', kk: 'Табан', en: 'Podiatry' } },
  { key: 'accessibility', Icon: Accessibility, label: { ru: 'Реабилитация', kk: 'Оңалту', en: 'Rehabilitation' } },
  { key: 'lungs', Icon: Wind, label: { ru: 'Дыхание', kk: 'Тыныс алу', en: 'Breathing' } },
  { key: 'pulse', Icon: Activity, label: { ru: 'Функциональная диагностика', kk: 'Функционалдық диагностика', en: 'Diagnostics' } },
  { key: 'ribbon', Icon: Ribbon, label: { ru: 'Онкология', kk: 'Онкология', en: 'Oncology' } },
  { key: 'radiation', Icon: Radiation, label: { ru: 'Лучевая терапия', kk: 'Сәулелік терапия', en: 'Radiotherapy' } },
  { key: 'dna', Icon: Dna, label: { ru: 'Генетика', kk: 'Генетика', en: 'Genetics' } },
  { key: 'microscope', Icon: Microscope, label: { ru: 'Лаборатория', kk: 'Зертхана', en: 'Laboratory' } },
  { key: 'test-tube', Icon: TestTube, label: { ru: 'Анализы', kk: 'Талдаулар', en: 'Tests' } },
  { key: 'syringe', Icon: Syringe, label: { ru: 'Процедуры', kk: 'Емшаралар', en: 'Procedures' } },
  { key: 'pill', Icon: Pill, label: { ru: 'Лекарства', kk: 'Дәрілер', en: 'Medication' } },
  { key: 'thermometer', Icon: Thermometer, label: { ru: 'Инфекции', kk: 'Инфекциялар', en: 'Infections' } },
  { key: 'apple', Icon: Apple, label: { ru: 'Питание', kk: 'Тамақтану', en: 'Nutrition' } },
  { key: 'bandage', Icon: Bandage, label: { ru: 'Травматология', kk: 'Травматология', en: 'Traumatology' } },
  { key: 'hand-heart', Icon: HandHeart, label: { ru: 'Паллиативная помощь', kk: 'Паллиативтік көмек', en: 'Palliative care' } },
  { key: 'ambulance', Icon: Ambulance, label: { ru: 'Неотложная помощь', kk: 'Шұғыл көмек', en: 'Emergency' } },
  { key: 'hospital', Icon: Hospital, label: { ru: 'Стационар', kk: 'Стационар', en: 'Hospital' } },
]

const ICONS_BY_KEY = new Map(SPECIALIZATION_ICONS.map((entry) => [entry.key, entry]))

// Иконка по названию — для записей без иконки или со старым ключом.
const ICONS_BY_NAME = {
  Кардиолог: HeartPulse,
  Терапевт: Stethoscope,
  Невролог: Brain,
  Дерматолог: ScanFace,
  Гастроэнтеролог: StomachIcon,
  Эндокринолог: ThyroidIcon,
  Офтальмолог: Eye,
  Уролог: Droplets,
  Отоларинголог: Ear,
  ЛОР: Ear,
  Психотерапевт: BrainCog,
  Психиатр: BrainCog,
  Психолог: Smile,
  Педиатр: Baby,
  Гинеколог: Venus,
  Хирург: Scissors,
  Ортопед: Bone,
  Маммолог: Ribbon,
  Онколог: Ribbon,
  Аритмолог: Activity,
  Нейрохирург: Brain,
  Кардиохирург: HeartPulse,
}

// Старые ключи, которые лендинг показывал так (для названий вне ICONS_BY_NAME).
const LEGACY_ICONS = {
  hand: Fingerprint,
  shield: Fingerprint,
  activity: StomachIcon,
  droplet: ThyroidIcon,
  male: Droplets,
}

export const getSpecializationIconEntry = (key) => ICONS_BY_KEY.get(String(key || '').trim()) || null

export const getSpecializationIconLabel = (entry, language = 'ru') =>
  entry?.label?.[String(language || 'ru').split('-')[0]] || entry?.label?.ru || entry?.key || ''

/** Компонент иконки для специализации: выбранный ключ → название → старый ключ → стетоскоп. */
export function resolveSpecializationIcon(icon, name) {
  const key = String(icon || '').trim()
  return ICONS_BY_KEY.get(key)?.Icon ||
    ICONS_BY_NAME[String(name || '').trim()] ||
    LEGACY_ICONS[key.toLowerCase()] ||
    Stethoscope
}
