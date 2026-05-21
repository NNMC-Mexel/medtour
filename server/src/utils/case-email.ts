/**
 * Case email utility.
 *
 * Sends transactional emails to patients (and optionally to staff) when a
 * medical case changes status.  Uses Strapi's configured email provider
 * (Yandex SMTP via nodemailer).
 *
 * Language selection: patient.language field → falls back to 'ru'.
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface EmailRecipient {
  email?: string | null;
  fullName?: string | null;
  language?: string | null;
}

interface CaseRef {
  documentId?: string;
  caseNumber?: string | null;
  title?: string | null;
  patient?: EmailRecipient;
  manager?: EmailRecipient;
  doctor?: { fullName?: string | null };
}

// ── HTML template engine ───────────────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://medtour.nnmc.kz';
const BRAND_COLOR = '#0d9488'; // teal-600

function htmlWrapper(body: string, lang = 'ru'): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 32px;">
            <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px;">MedTour</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">Медицинский туризм в Казахстан</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              MedTour — медицинский туризм в Казахстан &nbsp;|&nbsp;
              <a href="${FRONTEND_URL}" style="color:${BRAND_COLOR};text-decoration:none;">medtour.nnmc.kz</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
              Если вы получили это письмо по ошибке — просто проигнорируйте его.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function caseLink(caseRef: CaseRef, role = 'patient'): string {
  const base = role === 'manager' ? '/manager' : role === 'doctor' ? '/doctor' : '/patient';
  return `${FRONTEND_URL}${base}/cases/${caseRef.documentId}`;
}

function btnHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:${BRAND_COLOR};color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">${label}</a>`;
}

function greeting(name?: string | null, lang = 'ru'): string {
  const n = name || (lang === 'kk' ? 'Сізге' : lang === 'en' ? 'Patient' : 'пациент');
  if (lang === 'kk') return `Құрметті ${n},`;
  if (lang === 'en') return `Dear ${n},`;
  return `Уважаемый(-ая) ${n},`;
}

function caseNumLine(ref: CaseRef, lang = 'ru'): string {
  const num = ref.caseNumber || ref.documentId || '—';
  if (lang === 'en') return `<p style="font-size:13px;color:#64748b;margin:8px 0 0;">Case: <strong style="color:#0f172a;">${num}</strong></p>`;
  if (lang === 'kk') return `<p style="font-size:13px;color:#64748b;margin:8px 0 0;">Кейс: <strong style="color:#0f172a;">${num}</strong></p>`;
  return `<p style="font-size:13px;color:#64748b;margin:8px 0 0;">Кейс: <strong style="color:#0f172a;">${num}</strong></p>`;
}

// ── Per-status templates ───────────────────────────────────────────────────

type Template = { subject: string; html: (ref: CaseRef) => string };

function templates(lang: string): Record<string, Template> {
  const l = lang;
  return {
    REGISTERED: {
      subject: l === 'en' ? 'Your case has been registered — MedTour'
              : l === 'kk' ? 'Сіздің кейсіңіз тіркелді — MedTour'
              : 'Ваш кейс зарегистрирован — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${
          l === 'en' ? '✅ Case registered' : l === 'kk' ? '✅ Кейс тіркелді' : '✅ Кейс принят в систему'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Your medical case has been successfully registered. Our manager will be in touch within a few hours.'
            : l === 'kk'
            ? 'Сіздің медициналық кейсіңіз тіркелді. Менеджеріміз жақын арада хабарласады.'
            : 'Ваш медицинский кейс успешно зарегистрирован в системе. Наш менеджер свяжется с вами в течение нескольких часов.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'View my case' : l === 'kk' ? 'Кейсті ашу' : 'Открыть кейс')}
      `, l),
    },

    WAITING_FOR_DOCUMENTS: {
      subject: l === 'en' ? 'Please upload your medical documents — MedTour'
              : l === 'kk' ? 'Медициналық құжаттарды жүктеңіз — MedTour'
              : 'Загрузите медицинские документы — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">📄 ${
          l === 'en' ? 'Documents required' : l === 'kk' ? 'Құжаттар қажет' : 'Нужны документы'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'To proceed, please upload your medical records: analyses, MRI/CT scans, discharge summaries, or any other relevant documents.'
            : l === 'kk'
            ? 'Жалғастыру үшін медициналық құжаттарыңызды жүктеңіз: анализдер, МРТ/КТ, шығу эпикризі немесе басқа да маңызды құжаттар.'
            : 'Для продолжения загрузите медицинские документы: анализы, МРТ/КТ, выписки, или любые другие релевантные материалы.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'Upload documents' : l === 'kk' ? 'Құжат жүктеу' : 'Загрузить документы')}
      `, l),
    },

    DOCTOR_ASSIGNED: {
      subject: l === 'en' ? 'A doctor has been assigned to your case — MedTour'
              : l === 'kk' ? 'Сіздің кейсіңізге дәрігер тағайындалды — MedTour'
              : 'Врач назначен для вашего кейса — MedTour',
      html: (ref) => {
        const docName = ref.doctor?.fullName;
        return htmlWrapper(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">👨‍⚕️ ${
            l === 'en' ? 'Doctor assigned' : l === 'kk' ? 'Дәрігер тағайындалды' : 'Врач назначен'
          }</h2>
          ${caseNumLine(ref, l)}
          <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
            ${greeting(ref.patient?.fullName, l)}<br/><br/>
            ${l === 'en'
              ? `A specialist${docName ? ` — <strong>${docName}</strong>` : ''} has been assigned to review your case.`
              : l === 'kk'
              ? `Кейсіңізді қарауға маман${docName ? ` — <strong>${docName}</strong>` : ''} тағайындалды.`
              : `К рассмотрению вашего кейса назначен специалист${docName ? ` — <strong>${docName}</strong>` : ''}.`}
          </p>
          ${btnHtml(caseLink(ref), l === 'en' ? 'View case' : l === 'kk' ? 'Кейсті ашу' : 'Открыть кейс')}
        `, l);
      },
    },

    WAITING_PATIENT_CONFIRMATION: {
      subject: l === 'en' ? 'Your case has been reviewed — action required — MedTour'
              : l === 'kk' ? 'Кейсіңіз қаралды — растауыңыз қажет — MedTour'
              : 'Кейс рассмотрен — требуется ваше подтверждение — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">⚡ ${
          l === 'en' ? 'Your confirmation required' : l === 'kk' ? 'Растауыңыз қажет' : 'Требуется ваше решение'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'The doctor has reviewed your case. Please log in to view the treatment plan and confirm your decision.'
            : l === 'kk'
            ? 'Дәрігер сіздің кейсіңізді қарастырды. Емдеу жоспарын қарап, шешіміңізді растауыңызды сұраймыз.'
            : 'Врач рассмотрел ваш кейс. Пожалуйста, войдите в систему, чтобы ознакомиться с планом лечения и подтвердить решение.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'Review & confirm' : l === 'kk' ? 'Қарап растау' : 'Просмотреть и подтвердить')}
      `, l),
    },

    CONSULTATION_BOOKED: {
      subject: l === 'en' ? 'Your consultation has been scheduled — MedTour'
              : l === 'kk' ? 'Консультация жоспарланды — MedTour'
              : 'Консультация запланирована — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">📅 ${
          l === 'en' ? 'Consultation booked' : l === 'kk' ? 'Консультация жоспарланды' : 'Консультация забронирована'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Great news! Your video consultation with the doctor has been booked. You will find the link in your appointments section.'
            : l === 'kk'
            ? 'Тамаша жаңалық! Дәрігермен видео консультация жоспарланды. Сілтемені "Кездесулер" бөлімінен таба аласыз.'
            : 'Отличная новость! Видеоконсультация с врачом забронирована. Ссылку вы найдёте в разделе "Мои записи".'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'View appointment' : l === 'kk' ? 'Кездесуді ашу' : 'Открыть запись')}
      `, l),
    },

    TREATMENT_PLAN_SENT: {
      subject: l === 'en' ? 'Your treatment plan is ready — MedTour'
              : l === 'kk' ? 'Емдеу жоспары дайын — MedTour'
              : 'Ваш план лечения готов — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">📋 ${
          l === 'en' ? 'Treatment plan ready' : l === 'kk' ? 'Емдеу жоспары дайын' : 'План лечения готов'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'The doctor has prepared a personalised treatment plan for you. Please review it and accept or decline.'
            : l === 'kk'
            ? 'Дәрігер сізге арнайы емдеу жоспарын дайындады. Оны қарап, қабылдайсыз ба, жоқ па — шешіңіз.'
            : 'Врач подготовил персонализированный план лечения специально для вас. Ознакомьтесь и примите решение.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'View treatment plan' : l === 'kk' ? 'Жоспарды қарау' : 'Просмотреть план')}
      `, l),
    },

    WAITING_PAYMENT: {
      subject: l === 'en' ? 'Payment required to proceed — MedTour'
              : l === 'kk' ? 'Жалғастыру үшін төлем қажет — MedTour'
              : 'Требуется оплата для продолжения — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">💳 ${
          l === 'en' ? 'Payment required' : l === 'kk' ? 'Төлем қажет' : 'Необходима оплата'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Your treatment plan has been approved. Please proceed to payment to confirm your visit.'
            : l === 'kk'
            ? 'Емдеу жоспары бекітілді. Келуіңізді растау үшін төлемді аяқтаңыз.'
            : 'Ваш план лечения одобрен. Пожалуйста, оплатите для подтверждения вашего приезда.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'Proceed to payment' : l === 'kk' ? 'Төлемге өту' : 'Перейти к оплате')}
      `, l),
    },

    PAYMENT_RECEIVED: {
      subject: l === 'en' ? 'Payment received — preparing for your visit — MedTour'
              : l === 'kk' ? 'Төлем алынды — келуіңізге дайындалуда — MedTour'
              : 'Оплата получена — готовимся к вашему визиту — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">✅ ${
          l === 'en' ? 'Payment confirmed' : l === 'kk' ? 'Төлем расталды' : 'Оплата подтверждена'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Your payment has been received. Our coordinator will now arrange your travel details: visa, hotel, and transfer.'
            : l === 'kk'
            ? 'Төлемді алдық. Координаторымыз сапар мәліметтерін (виза, қонақ үй, трансфер) реттей бастайды.'
            : 'Ваш платёж получен. Наш координатор приступает к организации вашего визита: виза, гостиница, трансфер.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'Track my case' : l === 'kk' ? 'Кейсімді қадағалау' : 'Отслеживать кейс')}
      `, l),
    },

    TRAVEL_PREPARATION: {
      subject: l === 'en' ? 'Travel preparation underway — MedTour'
              : l === 'kk' ? 'Сапарға дайындық жүріп жатыр — MedTour'
              : 'Идёт подготовка к вашему визиту — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">✈️ ${
          l === 'en' ? 'Travel preparation' : l === 'kk' ? 'Сапарға дайындық' : 'Подготовка к поездке'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Our coordinator is arranging your travel: visa documents, hotel, and airport transfer. Check the trip checklist in your case for updates.'
            : l === 'kk'
            ? 'Координаторымыз сапарыңызды ұйымдастырып жатыр: виза, қонақ үй, трансфер. Чек-парақтан барысын қадағалаңыз.'
            : 'Координатор оформляет вашу поездку: визовые документы, гостиница, трансфер из аэропорта. Следите за чеклистом в кейсе.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'View trip checklist' : l === 'kk' ? 'Чек-парақты ашу' : 'Открыть чеклист')}
      `, l),
    },

    TREATMENT_COMPLETED: {
      subject: l === 'en' ? 'Your treatment is complete — MedTour'
              : l === 'kk' ? 'Емдеу аяқталды — MedTour'
              : 'Ваше лечение завершено — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">🎉 ${
          l === 'en' ? 'Treatment complete!' : l === 'kk' ? 'Емдеу аяқталды!' : 'Лечение завершено!'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Congratulations on completing your treatment! We hope everything went well. You can find follow-up instructions in your case.'
            : l === 'kk'
            ? 'Емдеуді аяқтағаныңызбен құттықтаймыз! Барлығы жақсы болды деп үміттенеміз. Кейсте одан кейінгі нұсқаулар бар.'
            : 'Поздравляем с завершением лечения! Надеемся, всё прошло хорошо. Рекомендации по наблюдению доступны в вашем кейсе.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'View aftercare' : l === 'kk' ? 'Кейсті ашу' : 'Открыть кейс')}
      `, l),
    },

    COMPLETED: {
      subject: l === 'en' ? 'Your case is successfully closed — MedTour'
              : l === 'kk' ? 'Кейсіңіз сәтті жабылды — MedTour'
              : 'Ваш кейс успешно завершён — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">🏆 ${
          l === 'en' ? 'Case closed' : l === 'kk' ? 'Кейс жабылды' : 'Кейс закрыт'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Your medical case has been successfully completed. Thank you for trusting MedTour. We would appreciate a review of your experience!'
            : l === 'kk'
            ? 'Медициналық кейсіңіз сәтті аяқталды. MedTour-ға сенгеніңіз үшін рахмет! Пікіріңізді қалдырсаңыз өте жақсы болады!'
            : 'Ваш медицинский кейс успешно завершён. Спасибо за доверие MedTour! Будем рады вашему отзыву.'}
        </p>
        ${btnHtml(caseLink(ref), l === 'en' ? 'Leave a review' : l === 'kk' ? 'Пікір қалдыру' : 'Оставить отзыв')}
      `, l),
    },

    CANCELLED: {
      subject: l === 'en' ? 'Your case has been cancelled — MedTour'
              : l === 'kk' ? 'Кейсіңіз жойылды — MedTour'
              : 'Ваш кейс отменён — MedTour',
      html: (ref) => htmlWrapper(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">❌ ${
          l === 'en' ? 'Case cancelled' : l === 'kk' ? 'Кейс жойылды' : 'Кейс отменён'
        }</h2>
        ${caseNumLine(ref, l)}
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greeting(ref.patient?.fullName, l)}<br/><br/>
          ${l === 'en'
            ? 'Your medical case has been cancelled. If you have questions or wish to reopen a new case, please contact us.'
            : l === 'kk'
            ? 'Медициналық кейсіңіз жойылды. Сұрақтарыңыз болса немесе жаңа кейс ашғыңыз келсе, бізбен хабарласыңыз.'
            : 'Ваш медицинский кейс отменён. Если у вас есть вопросы или вы хотите открыть новый кейс — свяжитесь с нами.'}
        </p>
        ${btnHtml(FRONTEND_URL + '/patient/cases', l === 'en' ? 'Open new case' : l === 'kk' ? 'Жаңа кейс' : 'Открыть новый кейс')}
      `, l),
    },
  };
}

// ── Staff notification template ────────────────────────────────────────────

function newLeadEmailForManager(ref: CaseRef): { subject: string; html: string } {
  const caseLabel = ref.caseNumber || ref.documentId || 'Unknown';
  const patientName = ref.patient?.fullName || ref.patient?.email || 'Unknown patient';
  return {
    subject: `🆕 Новая заявка: ${caseLabel} — MedTour`,
    html: htmlWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">🆕 Новая заявка от пациента</h2>
      <p style="font-size:13px;color:#64748b;margin:8px 0 0;">Кейс: <strong style="color:#0f172a;">${caseLabel}</strong></p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
        Пациент <strong>${patientName}</strong> создал новый медицинский кейс.<br/>
        SLA: 2 часа до назначения менеджера.
      </p>
      ${btnHtml(`${FRONTEND_URL}/manager/cases/${ref.documentId}`, 'Открыть кейс')}
    `),
  };
}

function slaOverdueEmailForStaff(
  ref: CaseRef,
  status: string,
  slaHours: number,
  recipientName?: string | null,
): { subject: string; html: string } {
  const caseLabel = ref.caseNumber || ref.documentId || 'Unknown';
  return {
    subject: `⚠️ SLA нарушен: ${caseLabel} (${status}) — MedTour`,
    html: htmlWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626;">⚠️ SLA нарушен</h2>
      <p style="font-size:13px;color:#64748b;margin:8px 0 0;">Кейс: <strong style="color:#0f172a;">${caseLabel}</strong></p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">
        Здравствуйте${recipientName ? `, <strong>${recipientName}</strong>` : ''},<br/><br/>
        Кейс находится в статусе <strong>${status}</strong> уже более <strong>${slaHours}ч</strong> без движения.<br/>
        Пожалуйста, обновите статус или свяжитесь с пациентом.
      </p>
      ${btnHtml(`${FRONTEND_URL}/manager/cases/${ref.documentId}`, 'Открыть кейс')}
    `),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a status-change email to the patient.
 * Silently skips if SMTP is not configured, patient email is missing,
 * or there is no template for this status.
 */
export async function sendCaseStatusEmail(
  strapi: any,
  caseRef: CaseRef,
  toStatus: string,
): Promise<void> {
  const email = caseRef.patient?.email;
  if (!email) return;

  const lang = caseRef.patient?.language || 'ru';
  const tplMap = templates(lang);
  const tpl = tplMap[toStatus];
  if (!tpl) return;

  try {
    await strapi.plugins['email'].services.email.send({
      to: email,
      subject: tpl.subject,
      html: tpl.html(caseRef),
    });
    strapi.log.info(`[case-email] Sent "${toStatus}" email to ${email}`);
  } catch (err: any) {
    strapi.log.warn(`[case-email] Failed to send "${toStatus}" to ${email}: ${err?.message}`);
  }
}

/**
 * Notify all admins + managers of a newly created (NEW_LEAD) case.
 */
export async function sendNewLeadEmailToStaff(
  strapi: any,
  caseRef: CaseRef,
): Promise<void> {
  try {
    const managers = await strapi.query('plugin::users-permissions.user').findMany({
      where: { userRole: { $in: ['manager', 'admin'] } },
      select: ['email', 'fullName'],
      limit: 50,
    });

    const { subject, html } = newLeadEmailForManager(caseRef);
    await Promise.all(
      managers
        .filter((m: any) => m?.email)
        .map((m: any) =>
          strapi.plugins['email'].services.email.send({ to: m.email, subject, html }).catch(
            (e: any) => strapi.log.warn(`[case-email] new_lead to ${m.email}: ${e?.message}`)
          )
        )
    );
  } catch (err: any) {
    strapi.log.warn(`[case-email] sendNewLeadEmailToStaff error: ${err?.message}`);
  }
}

/**
 * Send SLA overdue alert to a specific staff member.
 */
export async function sendSlaOverdueEmail(
  strapi: any,
  recipient: EmailRecipient,
  caseRef: CaseRef,
  status: string,
  slaHours: number,
): Promise<void> {
  const email = recipient?.email;
  if (!email) return;

  const { subject, html } = slaOverdueEmailForStaff(caseRef, status, slaHours, recipient.fullName);
  try {
    await strapi.plugins['email'].services.email.send({ to: email, subject, html });
    strapi.log.info(`[case-email] SLA overdue email sent to ${email} for case ${caseRef.caseNumber}`);
  } catch (err: any) {
    strapi.log.warn(`[case-email] SLA overdue email to ${email} failed: ${err?.message}`);
  }
}
