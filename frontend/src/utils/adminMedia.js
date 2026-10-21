// Загрузка фото в разделах админки, которые хранят картинки в Global (JSON).

export const ADMIN_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const ADMIN_IMAGE_MAX_BYTES = 10 * 1024 * 1024

export const isAcceptableImage = (file) => Boolean(file) && ADMIN_IMAGE_TYPES.has(file.type) && file.size <= ADMIN_IMAGE_MAX_BYTES

export const getMediaId = (media) => (media && typeof media === 'object' ? Number(media.id) || null : null)

// Сервер принимает только пути (/api/file-proxy/…, /uploads/…): S3-провайдер
// отдаёт полный адрес, а сохранённый адрес не должен зависеть от домена.
export const toStoredMedia = (media) => {
  let url = media.url
  if (typeof url === 'string' && url.startsWith('http')) {
    try {
      const parsed = new URL(url)
      if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/file-proxy/')) {
        url = `${parsed.pathname}${parsed.search}`
      }
    } catch {
      // оставляем как есть — сервер отклонит, админ увидит ошибку
    }
  }
  return { id: media.id, url, name: media.name || '', alternativeText: media.alternativeText || '' }
}

export const transliterateSlug = (value) => {
  const map = { а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', і: 'i', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
  return String(value || '').toLocaleLowerCase('ru').split('').map((char) => map[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
}

/** Свободный id на основе названия: burabay, burabay-2, … */
export const uniqueSlug = (name, usedIds, fallback = 'item') => {
  const base = transliterateSlug(name) || fallback
  const used = new Set(usedIds)
  let id = base
  for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`
  return id
}

export const withOrder = (items) => items.map((item, index) => ({ ...item, sortOrder: index + 1 }))

// Строки списков редактируются как текст, в данных — массив.
export const linesToArray = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean)
