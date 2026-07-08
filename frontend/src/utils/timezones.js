const TIMEZONES = Intl.supportedValuesOf('timeZone').sort()

const timezoneNamesCache = new Map()

const countryToTimezone = {
  AF: 'Asia/Kabul',
  AX: 'Europe/Helsinki',
  AL: 'Europe/Tirane',
  DZ: 'Africa/Algiers',
  AS: 'Pacific/Pago_Pago',
  AD: 'Europe/Andorra',
  AO: 'Africa/Luanda',
  AI: 'America/Anguilla',
  AQ: 'Antarctica/Casey',
  AG: 'America/Antigua',
  AR: 'America/Argentina/Buenos_Aires',
  AM: 'Asia/Yerevan',
  AW: 'America/Aruba',
  AU: 'Australia/Sydney',
  AT: 'Europe/Vienna',
  AZ: 'Asia/Baku',
  BS: 'America/Nassau',
  BH: 'Asia/Bahrain',
  BD: 'Asia/Dhaka',
  BB: 'America/Barbados',
  BY: 'Europe/Minsk',
  BE: 'Europe/Brussels',
  BZ: 'America/Belize',
  BJ: 'Africa/Porto-Novo',
  BM: 'Atlantic/Bermuda',
  BT: 'Asia/Thimphu',
  BO: 'America/La_Paz',
  BA: 'Europe/Sarajevo',
  BW: 'Africa/Gaborone',
  BR: 'America/Sao_Paulo',
  BN: 'Asia/Brunei',
  BG: 'Europe/Sofia',
  BF: 'Africa/Ouagadougou',
  BI: 'Africa/Bujumbura',
  KH: 'Asia/Phnom_Penh',
  CM: 'Africa/Douala',
  CA: 'America/Toronto',
  CV: 'Atlantic/Cape_Verde',
  KY: 'America/Cayman',
  CF: 'Africa/Bangui',
  TD: 'Africa/Ndjamena',
  CL: 'America/Santiago',
  CN: 'Asia/Shanghai',
  CX: 'Indian/Christmas',
  CC: 'Indian/Cocos',
  CO: 'America/Bogota',
  KM: 'Indian/Comoro',
  CG: 'Africa/Brazzaville',
  CD: 'Africa/Kinshasa',
  CK: 'Pacific/Rarotonga',
  CR: 'America/Costa_Rica',
  CI: 'Africa/Abidjan',
  HR: 'Europe/Zagreb',
  CU: 'America/Havana',
  CY: 'Europe/Nicosia',
  CZ: 'Europe/Prague',
  DK: 'Europe/Copenhagen',
  DJ: 'Africa/Djibouti',
  DM: 'America/Dominica',
  DO: 'America/Santo_Domingo',
  EC: 'America/Guayaquil',
  EG: 'Africa/Cairo',
  SV: 'America/El_Salvador',
  GQ: 'Africa/Malabo',
  ER: 'Africa/Asmara',
  EE: 'Europe/Tallinn',
  ET: 'Africa/Addis_Ababa',
  FK: 'Atlantic/Stanley',
  FO: 'Atlantic/Faroe',
  FJ: 'Pacific/Fiji',
  FI: 'Europe/Helsinki',
  FR: 'Europe/Paris',
  GF: 'America/Cayenne',
  PF: 'Pacific/Tahiti',
  TF: 'Indian/Reunion',
  GA: 'Africa/Gabon',
  GM: 'Africa/Banjul',
  GE: 'Asia/Tbilisi',
  DE: 'Europe/Berlin',
  GH: 'Africa/Accra',
  GI: 'Europe/Gibraltar',
  GR: 'Europe/Athens',
  GL: 'America/Godthab',
  GD: 'America/Grenada',
  GP: 'America/Guadeloupe',
  GU: 'Pacific/Guam',
  GT: 'America/Guatemala',
  GG: 'Europe/Guernsey',
  GN: 'Africa/Conakry',
  GW: 'Africa/Bissau',
  GY: 'America/Guyana',
  HT: 'America/Haiti',
  HM: 'Antarctica/Hobart',
  HN: 'America/Tegucigalpa',
  HK: 'Asia/Hong_Kong',
  HU: 'Europe/Budapest',
  IS: 'Atlantic/Reykjavik',
  IN: 'Asia/Kolkata',
  ID: 'Asia/Jakarta',
  IR: 'Asia/Tehran',
  IQ: 'Asia/Baghdad',
  IE: 'Europe/Dublin',
  IM: 'Europe/Isle_of_Man',
  IL: 'Asia/Jerusalem',
  IT: 'Europe/Rome',
  JM: 'America/Jamaica',
  JP: 'Asia/Tokyo',
  JE: 'Europe/Jersey',
  JO: 'Asia/Amman',
  KZ: 'Asia/Almaty',
  KE: 'Africa/Nairobi',
  KI: 'Pacific/Kiritimati',
  KP: 'Asia/Pyongyang',
  KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait',
  KG: 'Asia/Bishkek',
  LA: 'Asia/Vientiane',
  LV: 'Europe/Riga',
  LB: 'Asia/Beirut',
  LS: 'Africa/Maseru',
  LR: 'Africa/Monrovia',
  LY: 'Africa/Tripoli',
  LI: 'Europe/Zurich',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  MO: 'Asia/Macau',
  MK: 'Europe/Skopje',
  MG: 'Indian/Antananarivo',
  MW: 'Africa/Lilongwe',
  MY: 'Asia/Kuala_Lumpur',
  MV: 'Indian/Maldives',
  ML: 'Africa/Bamako',
  MT: 'Europe/Malta',
  MH: 'Pacific/Majuro',
  MQ: 'America/Martinique',
  MR: 'Africa/Nouakchott',
  MU: 'Indian/Mauritius',
  YT: 'Indian/Mayotte',
  MX: 'America/Mexico_City',
  FM: 'Pacific/Chuuk',
  MD: 'Europe/Chisinau',
  MC: 'Europe/Monaco',
  MN: 'Asia/Ulaanbaatar',
  ME: 'Europe/Podgorica',
  MA: 'Africa/Casablanca',
  MZ: 'Africa/Maputo',
  MM: 'Asia/Yangon',
  NA: 'Africa/Windhoek',
  NR: 'Pacific/Nauru',
  NP: 'Asia/Kathmandu',
  NL: 'Europe/Amsterdam',
  NC: 'Pacific/Noumea',
  NZ: 'Pacific/Auckland',
  NI: 'America/Managua',
  NE: 'Africa/Niamey',
  NG: 'Africa/Lagos',
  NU: 'Pacific/Niue',
  NF: 'Australia/Norfolk',
  NO: 'Europe/Oslo',
  OM: 'Asia/Muscat',
  PK: 'Asia/Karachi',
  PW: 'Pacific/Palau',
  PS: 'Asia/Hebron',
  PA: 'America/Panama',
  PG: 'Pacific/Port_Moresby',
  PY: 'America/Asuncion',
  PE: 'America/Lima',
  PH: 'Asia/Manila',
  PN: 'Pacific/Pitcairn',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  PR: 'America/Puerto_Rico',
  QA: 'Asia/Qatar',
  RE: 'Indian/Reunion',
  RO: 'Europe/Bucharest',
  RU: 'Europe/Moscow',
  RW: 'Africa/Kigali',
  BL: 'America/St_Barthelemy',
  SH: 'Atlantic/St_Helena',
  KN: 'America/St_Kitts',
  LC: 'America/St_Lucia',
  MF: 'America/Marigot',
  PM: 'America/Miquelon',
  VC: 'America/St_Vincent',
  WS: 'Pacific/Apia',
  SM: 'Europe/San_Marino',
  ST: 'Africa/Sao_Tome',
  SA: 'Asia/Riyadh',
  SN: 'Africa/Dakar',
  RS: 'Europe/Belgrade',
  SC: 'Indian/Mahe',
  SL: 'Africa/Freetown',
  SG: 'Asia/Singapore',
  SX: 'America/Curacao',
  SK: 'Europe/Bratislava',
  SI: 'Europe/Ljubljana',
  SB: 'Pacific/Guadalcanal',
  SO: 'Africa/Mogadishu',
  ZA: 'Africa/Johannesburg',
  SS: 'Africa/Juba',
  ES: 'Europe/Madrid',
  LK: 'Asia/Colombo',
  SD: 'Africa/Khartoum',
  SR: 'America/Paramaribo',
  SJ: 'Arctic/Longyearbyen',
  SZ: 'Africa/Mbabane',
  SE: 'Europe/Stockholm',
  CH: 'Europe/Zurich',
  SY: 'Asia/Damascus',
  TW: 'Asia/Taipei',
  TJ: 'Asia/Dushanbe',
  TZ: 'Africa/Dar_es_Salaam',
  TH: 'Asia/Bangkok',
  TL: 'Asia/Dili',
  TG: 'Africa/Lome',
  TK: 'Pacific/Tokelau',
  TO: 'Pacific/Tongatapu',
  TT: 'America/Port_of_Spain',
  TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul',
  TM: 'Asia/Ashkhabad',
  TV: 'Pacific/Funafuti',
  UG: 'Africa/Kampala',
  UA: 'Europe/Kyiv',
  AE: 'Asia/Dubai',
  GB: 'Europe/London',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent',
  VU: 'Pacific/Efate',
  VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh',
  VG: 'America/Virgin',
  VI: 'America/Virgin',
  WF: 'Pacific/Wallis',
  YE: 'Asia/Aden',
  ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
}

export function getTimezoneList() {
  return TIMEZONES
}

export function getTimezoneLabel(timezone) {
  if (!timezone || !TIMEZONES.includes(timezone)) return timezone

  if (timezoneNamesCache.has(timezone)) {
    return timezoneNamesCache.get(timezone)
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    formatter.formatToParts(new Date())
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')

    const label = `${timezone} ${offset?.value || ''}`
    timezoneNamesCache.set(timezone, label)
    return label
  } catch {
    timezoneNamesCache.set(timezone, timezone)
    return timezone
  }
}

export function getDefaultTimezoneForCountry(countryCode) {
  const normalized = String(countryCode || '').trim().toUpperCase()
  return countryToTimezone[normalized] || 'UTC'
}

export function normalizeTimezoneValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (TIMEZONES.includes(raw)) return raw
  return raw
}

export function getTimezoneOptions() {
  return TIMEZONES.map((tz) => ({
    value: tz,
    label: getTimezoneLabel(tz),
  }))
}

export function foldTimezoneText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}
