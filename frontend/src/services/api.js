import axios from "axios";

// =====================================================
// КОНФИГУРАЦИЯ ДОМЕНОВ ДЛЯ ПРОДАКШНА
// =====================================================
// Frontend:        https://medtour.nnmc.kz
// Strapi API:      https://medtourserver.nnmc.kz
// Signaling:       https://medtourrtc.nnmc.kz
// =====================================================

// URL для Strapi API
const PRODUCTION_API_URL = import.meta.env.VITE_PRODUCTION_API_URL || "https://medtourserver.nnmc.kz";
const DEVELOPMENT_API_URL = "http://localhost:1340";

// URL для Signaling Server
const PRODUCTION_SIGNALING_URL = import.meta.env.VITE_PRODUCTION_SIGNALING_URL || "https://medtourrtc.nnmc.kz";
const DEVELOPMENT_SIGNALING_URL = "http://localhost:1341";
const PRODUCTION_FRONTEND_HOSTS = import.meta.env.VITE_PRODUCTION_FRONTEND_HOSTS
  ? import.meta.env.VITE_PRODUCTION_FRONTEND_HOSTS.split(',').map(h => h.trim())
  : ["medtour.nnmc.kz", "www.medtour.nnmc.kz"];

export const getSignalingUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (PRODUCTION_FRONTEND_HOSTS.includes(hostname)) {
      return PRODUCTION_SIGNALING_URL;
    }
  }
  if (import.meta.env.VITE_SIGNALING_SERVER) {
    return import.meta.env.VITE_SIGNALING_SERVER;
  }
  const isProduction =
    import.meta.env.MODE === "production" || import.meta.env.PROD === true;
  return isProduction ? PRODUCTION_SIGNALING_URL : DEVELOPMENT_SIGNALING_URL;
};

// Определяем URL API в зависимости от окружения
const getApiUrl = () => {
  // ВАЖНО: Проверяем hostname в первую очередь - это самый надежный способ
  // для определения продакшна, так как работает в runtime
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Если мы на продакшн домене фронтенда - используем продакшн API домен
    if (PRODUCTION_FRONTEND_HOSTS.includes(hostname)) {
      return PRODUCTION_API_URL;
    }
  }
  
  // Проверяем переменную окружения (может быть задана через vite.config.js)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Проверяем другие способы определения продакшна
  const isProduction = 
    import.meta.env.MODE === 'production' || 
    import.meta.env.PROD === true;
  
  if (isProduction) {
    return PRODUCTION_API_URL;
  }
  
  // В режиме разработки используем localhost
  return DEVELOPMENT_API_URL;
};

let API_URL = getApiUrl();
const LARGE_COLLECTION_LIMIT = "1000";

export const getAuthToken = () => {
    const authStorage = localStorage.getItem("auth-storage");
    if (!authStorage) return null;

    try {
        const { state } = JSON.parse(authStorage);
        return state?.token || null;
    } catch (e) {
        console.error("Error parsing auth storage:", e);
        return null;
    }
};

// ВАЖНО: Переопределяем API_URL в runtime, если мы на продакшн домене
// Это гарантирует, что даже если сборка была сделана неправильно,
// мы все равно используем правильный домен
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (PRODUCTION_FRONTEND_HOSTS.includes(hostname)) {
    API_URL = PRODUCTION_API_URL;
  }
}

// Логируем только в dev-режиме
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  console.log('[API] API_URL:', API_URL);
  console.log('[API] Mode:', import.meta.env.MODE);
  console.log('[API] Hostname:', window.location.hostname);
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Дополнительная проверка: убеждаемся, что baseURL правильный
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (PRODUCTION_FRONTEND_HOSTS.includes(hostname) && 
      api.defaults.baseURL !== PRODUCTION_API_URL) {
    console.warn('[API] WARNING: baseURL is incorrect! Fixing...');
    api.defaults.baseURL = PRODUCTION_API_URL;
  }
}

// Request interceptor - добавляем токен и проверяем URL
api.interceptors.request.use(
    (config) => {
        // ВАЖНО: В продакшне принудительно устанавливаем правильный baseURL
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (PRODUCTION_FRONTEND_HOSTS.includes(hostname)) {
                // Принудительно устанавливаем правильный baseURL
                config.baseURL = PRODUCTION_API_URL;
                api.defaults.baseURL = PRODUCTION_API_URL;
            }
        }
        
        // Если baseURL не установлен, используем текущий API_URL
        if (!config.baseURL) {
            config.baseURL = api.defaults.baseURL || API_URL;
        }
        
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Server time sync ──────────────────────────────────────────────
// Девайсные часы нельзя доверять (неверный TZ / сбитое системное время).
// Каждый ответ сервера несёт заголовок `Date` — используем его как источник
// истины и храним дельту (серверное − локальное) в мс.
let serverTimeOffsetMs = 0;

export const getServerNow = () => new Date(Date.now() + serverTimeOffsetMs);
export const getServerTimeOffsetMs = () => serverTimeOffsetMs;

// Response interceptor - обработка ошибок + синхронизация времени
api.interceptors.response.use(
    (response) => {
        const dateHeader = response?.headers?.date;
        if (dateHeader) {
            const serverMs = Date.parse(dateHeader);
            if (!Number.isNaN(serverMs)) {
                serverTimeOffsetMs = serverMs - Date.now();
            }
        }
        return response;
    },
    (error) => {
        const dateHeader = error?.response?.headers?.date;
        if (dateHeader) {
            const serverMs = Date.parse(dateHeader);
            if (!Number.isNaN(serverMs)) {
                serverTimeOffsetMs = serverMs - Date.now();
            }
        }
        if (error.response?.status === 401) {
            localStorage.removeItem("auth-storage");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

// ===========================================
// HELPER FUNCTIONS для работы со Strapi v5
// ===========================================

/**
 * Нормализация данных из Strapi v5
 * Strapi v5 возвращает: { data: { id, ...fields } } или { data: [{ id, ...fields }] }
 */
export const normalizeData = (data) => {
    if (!data) return null;

    // Если это массив
    if (Array.isArray(data)) {
        return data.map((item) => normalizeItem(item));
    }

    // Если это объект
    return normalizeItem(data);
};

const normalizeItem = (item) => {
    if (!item) return null;

    // Strapi v5 формат - данные уже плоские, но связи могут быть вложенными
    const normalized = { ...item };

    // Нормализуем statuse -> status (Strapi хранит как "statuse" — опечатка в схеме)
    // Всегда ставим status чтобы фильтры в UI не ломались если поле отсутствует
    if (normalized.statuse !== undefined) {
        normalized.status = normalized.statuse;
    } else if (normalized.status === undefined) {
        normalized.status = 'pending';
    }

    // Нормализуем users_permissions_users -> participants для conversation
    if (normalized.users_permissions_users !== undefined) {
        normalized.participants = normalized.users_permissions_users;
    }

    // Рекурсивно обрабатываем вложенные связи
    Object.keys(normalized).forEach((key) => {
        const value = normalized[key];
        // Если это связь с data внутри
        if (value && typeof value === "object" && value.data !== undefined) {
            normalized[key] = normalizeData(value.data);
        }
        // Если это массив связей
        else if (Array.isArray(value) && value.length > 0 && value[0]?.id) {
            normalized[key] = value.map((v) => normalizeItem(v));
        }
    });

    return normalized;
};

/**
 * Нормализация ответа API
 */
export const normalizeResponse = (response) => {
    if (response?.data?.data !== undefined) {
        return {
            data: normalizeData(response.data.data),
            meta: response.data.meta,
        };
    }
    return response?.data;
};

// ===========================================
// API для загрузки файлов
// ===========================================

const UPLOAD_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const uploadFile = async (file) => {
    if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Недопустимый тип файла. Разрешены: JPEG, PNG, WebP, PDF, DOC, DOCX`)
    }
    if (file.size > UPLOAD_MAX_SIZE_BYTES) {
        throw new Error(`Файл слишком большой. Максимальный размер: 10 МБ`)
    }

    // Sanitize filename — strip path separators and non-printable characters
    const safeName = file.name.replace(/[^\w.-]/g, '_').slice(0, 255)
    const safeFile = new File([file], safeName, { type: file.type })

    const formData = new FormData();
    formData.append("files", safeFile);

    const response = await api.post("/api/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data[0];
};

export const deleteFile = async (fileId) => {
    await api.delete(`/api/upload/files/${fileId}`);
};

// ===========================================
// API для медиафайлов
// ===========================================

export const getMediaUrl = (media) => {
    if (!media) return null;

    // Если это строка - уже URL
    if (typeof media === "string") {
        return media.startsWith("http") ? media : `${API_URL}${media}`;
    }

    // Strapi формат
    const url = media.url;
    if (!url) return null;

    const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
    const token = getAuthToken();

    if (token && fullUrl.includes("/api/file-proxy/") && !fullUrl.includes("token=")) {
        const separator = fullUrl.includes("?") ? "&" : "?";
        return `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
    }

    return fullUrl;
};

export const openMediaInNewTab = async (media) => {
    const url = getMediaUrl(media);
    if (!url) return;

    const response = await api.get(url, { responseType: "blob" });
    const objectUrl = URL.createObjectURL(response.data);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

// ===========================================
// API для аутентификации
// ===========================================

export const authAPI = {
    login: (identifier, password) =>
        api.post("/api/auth/local", { identifier, password }),

    register: (data) =>
        api.post("/api/auth/local/register", {
            username: data.email,
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            phone: data.phone,
            country: data.country,
            userRole: "patient",
        }),

    getMe: () => api.get("/api/users/me?populate=*"),

    updateProfile: (userId, data) => api.put(`/api/users/${userId}`, data),
};

export const usersAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("pagination[limit]", LARGE_COLLECTION_LIMIT);
        if (params.role) query.append("filters[userRole][$eq]", params.role);
        if (params.search) query.append("filters[fullName][$containsi]", params.search);
        return api.get(`/api/users?${query}`);
    },
};

// ===========================================
// API для врачей
// ===========================================

export const doctorsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", "rating:desc");
        query.append("pagination[limit]", LARGE_COLLECTION_LIMIT);

        // B2B model: public catalog shows only active clinic-approved doctors.
        // Admin screens pass includeInactive=true to manage hidden/disabled profiles.
        if (!params.includeInactive) {
            query.append('filters[isActive][$eq]', 'true');
        }

        if (params.specialization) {
            query.append(
                "filters[specialization][id][$eq]",
                params.specialization
            );
        }
        if (params.search) {
            query.append("filters[fullName][$containsi]", params.search);
        }

        return api.get(`/api/doctors?${query}`);
    },

    getOne: (id) => api.get(`/api/doctors/${id}?populate=*`),

    getBySpecialization: (specializationId) =>
        api.get(
            `/api/doctors?filters[specialization][id][$eq]=${specializationId}&filters[isActive][$eq]=true&populate=*&pagination[limit]=${LARGE_COLLECTION_LIMIT}`
        ),

    create: async (data) => {
        try {
            return await api.post("/api/doctors?status=published", { data });
        } catch (error) {
            // Fallback для окружений, где status query не поддержан
            if (error?.response?.status === 400 || error?.response?.status === 404) {
                return api.post("/api/doctors", {
                    data: {
                        ...data,
                        publishedAt: new Date().toISOString(),
                    },
                });
            }
            throw error;
        }
    },
    
    // Обновление профиля врача (включая настройки расписания)
    update: (id, data) => api.put(`/api/doctors/${id}`, { data }),

    delete: (id) => api.delete(`/api/doctors/${id}`),
    
    // Получение врача по user ID (используем поле userId)
    getByUserId: (userId) => 
        api.get(`/api/doctors?filters[userId][$eq]=${userId}&populate=*&pagination[limit]=1`),
};

// ===========================================
// API для специализаций
// ===========================================

export const specializationsAPI = {
    getAll: () =>
        api.get(
            `/api/specializations?populate=*&sort=sortOrder:asc,name:asc&pagination[limit]=${LARGE_COLLECTION_LIMIT}`
        ),

    getOne: (id) => api.get(`/api/specializations/${id}?populate=*`),

    create: async (data) => {
        try {
            return await api.post("/api/specializations?status=published", { data });
        } catch (error) {
            if (error?.response?.status === 400 || error?.response?.status === 404) {
                return api.post("/api/specializations", {
                    data: {
                        ...data,
                        publishedAt: new Date().toISOString(),
                    },
                });
            }
            throw error;
        }
    },

    update: (id, data) => api.put(`/api/specializations/${id}`, { data }),

    delete: (id) => api.delete(`/api/specializations/${id}`),
};

// ===========================================
// API для контента лендинга
// ===========================================

export const contentAPI = {
    getGlobal: () => api.get("/api/global?populate=*"),
    updateGlobal: (data) => api.put("/api/global", { data }),
    getAbout: () => api.get("/api/about?populate=*"),
    updateAbout: (data) => api.put("/api/about", { data }),
};

// ===========================================
// API для прайскуранта
// ===========================================

export const priceItemsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("sort", "sortOrder:asc,title:asc");
        query.append("pagination[limit]", LARGE_COLLECTION_LIMIT);

        if (!params.includeInactive) {
            query.append("filters[isActive][$eq]", "true");
        }
        if (params.featuredOnly) {
            query.append("filters[isFeatured][$eq]", "true");
        }
        if (params.category) {
            query.append("filters[category][$eq]", params.category);
        }

        return api.get(`/api/price-items?${query}`);
    },

    getOne: (id) => api.get(`/api/price-items/${id}`),

    create: async (data) => {
        try {
            return await api.post("/api/price-items?status=published", { data });
        } catch (error) {
            if (error?.response?.status === 400 || error?.response?.status === 404) {
                return api.post("/api/price-items", {
                    data: {
                        ...data,
                        publishedAt: new Date().toISOString(),
                    },
                });
            }
            throw error;
        }
    },

    update: (id, data) => api.put(`/api/price-items/${id}`, { data }),

    delete: (id) => api.delete(`/api/price-items/${id}`),
};

// ===========================================
// API для записей на приём
// ===========================================
export const appointmentsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate[doctor][populate][0]", "specialization");
        query.append("populate[doctor][populate][1]", "photo");
        query.append("populate[patient][fields][0]", "id");
        query.append("populate[patient][fields][1]", "fullName");
        query.append("sort", "dateTime:desc");

        if (params.status) {
            query.append("filters[statuse][$eq]", params.status);
        }

        return api.get(`/api/appointments?${query}`);
    },

    getOne: (id) =>
        api.get(
            `/api/appointments/${id}?populate[doctor][populate][0]=specialization&populate[doctor][populate][1]=photo&populate[patient][fields][0]=id&populate[patient][fields][1]=fullName&populate[patient][fields][2]=email&populate[patient][fields][3]=username&populate[patient][fields][4]=phone&populate[medical_documents][populate][file]=*`
        ),

    create: (data) => {
        // Strapi v5 требует числовые ID для связей
        const patientId = typeof data.patient === 'object' ? data.patient.id : data.patient;
        const doctorId = typeof data.doctor === 'object' ? data.doctor.id : data.doctor;
        
        const strapiData = {
            dateTime: data.dateTime,
            type: data.type || "video",
            consultationLanguage: data.language || data.consultationLanguage || "en",
            statuse: data.status || "confirmed",
            price: data.price,
            paymentStatus: data.paymentStatus || "paid",
            roomId: data.roomId,
            // Strapi v5 - пробуем разные форматы связей
            patient: patientId,
            doctor: doctorId,
            medical_case: data.medical_case || data.medicalCase || null,
        };
        
        return api.post("/api/appointments", { data: strapiData });
    },

    update: (id, data) => {
        const strapiData = { ...data };
        if (data.status) {
            strapiData.statuse = data.status;
            delete strapiData.status;
        }
        return api.put(`/api/appointments/${id}`, { data: strapiData });
    },

    cancel: (id) =>
        api.put(`/api/appointments/${id}`, { data: { statuse: "cancelled" } }),

    // Серверная проверка: можно ли подключиться к видеоконсультации сейчас.
    // Возвращает { allowed, reason, serverTime, dateTime, windowStart, windowEnd, status }.
    canJoin: (roomId) =>
        api.get(`/api/appointments/can-join/${encodeURIComponent(roomId)}`),
};
// ===========================================
// API для временных слотов
// ===========================================

export const timeSlotsAPI = {
    getAvailable: (doctorId, date) => {
        const query = new URLSearchParams();
        query.append("filters[doctor][id][$eq]", doctorId);
        query.append("filters[date][$eq]", date);
        query.append("filters[isBooked][$eq]", "false");
        query.append("sort", "time:asc");

        return api.get(`/api/time-slots?${query}`);
    },

    create: (data) => api.post("/api/time-slots", { data }),

    update: (id, data) => api.put(`/api/time-slots/${id}`, { data }),
};

// ===========================================
// API для получения занятых слотов врача
// ===========================================

export const getBookedSlots = async (doctorId, date) => {
    // Серверный эндпоинт обходит ownership-фильтр /api/appointments (пациент
    // видит только свои записи) и возвращает только массив строк "HH:mm" в
    // часовом поясе KZ. Таким образом при одновременной записи второй
    // пациент не видит уже забронированные другим пациентом слоты.
    try {
        const response = await api.get(
            `/api/appointments/booked-slots/${encodeURIComponent(doctorId)}?date=${encodeURIComponent(date)}`,
        );
        const slots = response?.data?.data?.slots;
        return Array.isArray(slots) ? slots : [];
    } catch (err) {
        console.error('getBookedSlots failed:', err);
        return [];
    }
};

// ===========================================
// API для диалогов
// ===========================================

export const conversationsAPI = {
    getAll: (userId) => {
        const query = new URLSearchParams();
        query.append("populate[users_permissions_users][populate]", "*");
        query.append("sort", "updatedAt:desc");

        if (userId) {
            query.append("filters[users_permissions_users][id][$eq]", userId);
        }

        return api.get(`/api/conversations?${query}`);
    },

    getOne: (id) =>
        api.get(
            `/api/conversations/${id}?populate[users_permissions_users][populate]=*&populate[messages][populate]=*`
        ),

    getForCase: (caseId) =>
        api.get(`/api/conversations/for-case/${encodeURIComponent(caseId)}`),

    getMessages: (id) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", "createdAt:asc");
        return api.get(`/api/conversations/${id}/messages?${query}`);
    },

    markRead: (id) => api.put(`/api/conversations/${id}/read`),

    takeover: (id) => api.put(`/api/conversations/${id}/takeover`),

    create: (participantIds) =>
        api.post("/api/conversations", {
            data: { users_permissions_users: participantIds },
        }),

    update: (id, data) => api.put(`/api/conversations/${id}`, { data }),
};

// ===========================================
// API для сообщений
// ===========================================

export const messagesAPI = {
    getByConversation: (conversationId) => {
        const query = new URLSearchParams();
        query.append("filters[conversation][id][$eq]", conversationId);
        query.append("populate", "*");
        query.append("sort", "createdAt:asc");

        return api.get(`/api/messages?${query}`);
    },

    create: (data) => api.post("/api/messages", { data }),

    markAsRead: (id) =>
        api.put(`/api/messages/${id}`, {
            data: { isRead: true, readAt: new Date().toISOString() },
        }),
};

// ===========================================
// API для медицинских документов (MedicalDocument)
// ===========================================

export const documentsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate[file]", "*");
        query.append("populate[user][fields][0]", "id");
        query.append("populate[user][fields][1]", "fullName");
        query.append("populate[doctor][populate][0]", "specialization");
        query.append("populate[doctor][fields][0]", "id");
        query.append("populate[doctor][fields][1]", "fullName");
        query.append("populate[appointment][populate][doctor][populate][0]", "specialization");
        query.append("populate[appointment][fields][0]", "id");
        query.append("populate[appointment][fields][1]", "dateTime");
        query.append("populate[appointment][fields][2]", "type");
        query.append("populate[sharedWithDoctors][populate][0]", "specialization");
        query.append("populate[sharedWithDoctors][fields][0]", "id");
        query.append("populate[sharedWithDoctors][fields][1]", "fullName");
        query.append("populate[sharedWithDoctors][fields][2]", "documentId");
        query.append("sort", "createdAt:desc");

        if (params.userId) {
            query.append("filters[user][id][$eq]", params.userId);
        }
        if (params.type) {
            query.append("filters[type][$eq]", params.type);
        }

        return api.get(`/api/medical-documents?${query}`);
    },

    getOne: (id) => api.get(`/api/medical-documents/${id}?populate=*`),

    create: (data) => api.post("/api/medical-documents", { data }),

    update: (id, data) => api.put(`/api/medical-documents/${id}`, { data }),

    delete: (id) => api.delete(`/api/medical-documents/${id}`),

    // Share document with doctors
    share: (documentId, doctorIds) =>
        api.put(`/api/medical-documents/${documentId}/share`, { data: { doctorIds } }),

    // Get list of doctors the patient has visited (for sharing picker)
    getMyDoctors: () => api.get("/api/medical-documents/my-doctors"),
};

// ===========================================
// API для MedTour medical cases
// ===========================================

export const medicalCasesAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", params.sort || "createdAt:desc");
        if (params.status) query.append("filters[status][$eq]", params.status);
        return api.get(`/api/medical-cases?${query}`);
    },

    getOne: (id) => api.get(`/api/medical-cases/${id}?populate=*`),

    create: (data) => api.post("/api/medical-cases", { data }),

    update: (id, data) => api.put(`/api/medical-cases/${id}`, { data }),

    delete: (id) => api.delete(`/api/medical-cases/${id}`),
};

export const clinicsAPI = {
    getAll: () => api.get(`/api/clinics?populate=*&filters[isActive][$eq]=true&pagination[limit]=${LARGE_COLLECTION_LIMIT}`),
    getOne: (id) => api.get(`/api/clinics/${id}?populate=*`),
    create: (data) => api.post("/api/clinics", { data }),
    update: (id, data) => api.put(`/api/clinics/${id}`, { data }),
};

export const treatmentPlansAPI = {
    getByCase: (caseId) =>
        api.get(`/api/treatment-plans?filters[medical_case][documentId][$eq]=${encodeURIComponent(caseId)}&populate=*`),
    create: (data) => api.post("/api/treatment-plans", { data }),
    update: (id, data) => api.put(`/api/treatment-plans/${id}`, { data }),
};

export const tripChecklistsAPI = {
    getByCase: (caseId) =>
        api.get(`/api/trip-checklists?filters[medical_case][documentId][$eq]=${encodeURIComponent(caseId)}&populate=*`),
    create: (data) => api.post("/api/trip-checklists", { data }),
    update: (id, data) => api.put(`/api/trip-checklists/${id}`, { data }),
};

export const visaRequestsAPI = {
    getByCase: (caseId) =>
        api.get(`/api/visa-requests?filters[medical_case][documentId][$eq]=${encodeURIComponent(caseId)}&populate=*`),
    create: (data) => api.post("/api/visa-requests", { data }),
    update: (id, data) => api.put(`/api/visa-requests/${id}`, { data }),
};

export const tourismPackagesAPI = {
    getByCase: (caseId) =>
        api.get(`/api/tourism-packages?filters[medical_case][documentId][$eq]=${encodeURIComponent(caseId)}&populate=*`),
    create: (data) => api.post("/api/tourism-packages", { data }),
    update: (id, data) => api.put(`/api/tourism-packages/${id}`, { data }),
};

export const caseEventsAPI = {
    getByCase: (caseId) =>
        api.get(`/api/case-events?filters[medical_case][documentId][$eq]=${encodeURIComponent(caseId)}&populate=*&sort=createdAt:asc`),
    create: (data) => api.post("/api/case-events", { data }),
};

export const financeLedgerAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", params.sort || "createdAt:desc");
        if (params.caseId) query.append("filters[medical_case][documentId][$eq]", params.caseId);
        if (params.reconciliationStatus) query.append("filters[reconciliationStatus][$eq]", params.reconciliationStatus);
        return api.get(`/api/finance-ledgers?${query}`);
    },
    create: (data) => api.post("/api/finance-ledgers", { data }),
    update: (id, data) => api.put(`/api/finance-ledgers/${id}`, { data }),
};

// ===========================================
// API для отзывов
// ===========================================

export const reviewsAPI = {
    getByDoctor: (doctorId) => {
        const query = new URLSearchParams();
        query.append("filters[doctor][id][$eq]", doctorId);
        query.append("filters[isPublished][$eq]", "true");
        query.append("populate", "*");
        query.append("sort", "createdAt:desc");
        query.append("pagination[limit]", LARGE_COLLECTION_LIMIT);

        return api.get(`/api/reviews?${query}`);
    },

    create: (data) => api.post("/api/reviews", { data }),
};

// ===========================================
// API для уведомлений
// ===========================================

export const notificationsAPI = {
    getAll: async (userId, { limit = 50 } = {}) => {
        if (!userId) return { data: { data: [] } };
        const query = new URLSearchParams();
        query.append("sort", "createdAt:desc");
        query.append("pagination[limit]", String(limit));
        return api.get(`/api/notifications?${query}`);
    },

    unreadCount: async () => {
        return api.get("/api/notifications/unread-count");
    },

    markAsRead: async (documentId) => {
        if (!documentId) return { data: { data: null } };
        return api.put(`/api/notifications/${documentId}`, { data: { isRead: true } });
    },

    markAllAsRead: async () => {
        return api.put("/api/notifications/mark-all-read");
    },

    remove: async (documentId) => {
        if (!documentId) return { data: { data: null } };
        return api.delete(`/api/notifications/${documentId}`);
    },
};
