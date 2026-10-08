import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    TreePalm,
    Video,
    MessageCircle,
    Loader2,
    Calendar,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import DoctorScheduleModal from "../../components/admin/DoctorScheduleModal";
import PreparationBadge from "../../components/appointments/PreparationBadge";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import useAuthStore from "../../stores/authStore";
import api, { normalizeResponse, getMediaUrl, getServerNow } from "../../services/api";
import {
    formatKazakhstanTime,
    getCalendarDateKey,
    getKazakhstanCalendarToday,
    getKazakhstanDateKey,
} from "../../utils/kazakhstanTime";
import {
    generateSlotsFromIntervals,
    getDoctorIntervalsForDate,
    getDoctorVacationForDate,
    isDoctorWorkingOnDate,
    timeToMinutes,
} from "../../utils/schedule";

function getAppointmentDetailsPath(appointment) {
    const appointmentId = appointment.documentId || appointment.id;
    const caseId = appointment.medical_case?.documentId || appointment.medical_case?.id;
    return caseId
        ? `/doctor/cases/${caseId}?tab=consultations&appointment=${appointmentId}`
        : `/doctor/appointments/${appointmentId}`;
}

function DoctorSchedule() {
    const { t, i18n } = useTranslation()
    const dateLocale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru
    const { user } = useAuthStore();
    const [doctor, setDoctor] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(getKazakhstanCalendarToday);
    const [selectedDate, setSelectedDate] = useState(getKazakhstanCalendarToday);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchDoctorAndAppointments();
        }
    }, [user?.id, currentDate]);

    const fetchDoctorAndAppointments = async () => {
        setIsLoading(true);
        try {
            let doctorRes = await api.get(
                `/api/doctors?filters[userId][$eq]=${user.id}&populate=*&pagination[limit]=1`
            );
            let doctorData = doctorRes.data?.data?.[0];

            console.log("Found doctor:", doctorData);
            setDoctor(doctorData);

            if (doctorData?.id) {
                // Получаем все записи и фильтруем на клиенте
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                const weekEnd = addDays(weekStart, 7);

                const appointmentsRes = await api.get(`/api/appointments?populate=*&pagination[limit]=1000`);
                const { data: allAppointments } = normalizeResponse(appointmentsRes);
                
                // Фильтруем на клиенте по врачу и дате
                const doctorAppointments = (allAppointments || []).filter(apt => {
                    const matchesDoctor =
                        apt.doctor?.id === doctorData.id ||
                        (doctorData.documentId && apt.doctor?.documentId === doctorData.documentId);
                    if (!matchesDoctor) return false;
                    const aptDate = getKazakhstanDateKey(apt.dateTime);
                    return aptDate >= getCalendarDateKey(weekStart) && aptDate < getCalendarDateKey(weekEnd);
                });
                
                console.log("Doctor appointments:", doctorAppointments);
                setAppointments(doctorAppointments);
            }
        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const goToPreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
    const goToNextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const goToToday = () => {
        const today = getKazakhstanCalendarToday();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    const getAppointmentsForDate = (date) => {
        const dateStr = getCalendarDateKey(date);
        return appointments.filter((apt) => {
            const aptDate = getKazakhstanDateKey(apt.dateTime);
            return aptDate === dateStr;
        });
    };

    // Расписание врача: интервалы по дням недели или датам и отпуска.
    const scheduleDoctor = doctor || {};
    const slotDuration = Number(doctor?.slotDuration) || 30;
    const isWorkingDay = (date) => isDoctorWorkingOnDate(scheduleDoctor, date);
    const selectedDateIntervals = getDoctorIntervalsForDate(scheduleDoctor, selectedDate);
    const selectedDateVacation = getDoctorVacationForDate(scheduleDoctor, selectedDate);

    const selectedAppointments = getAppointmentsForDate(selectedDate);

    // Слоты дня по графику плюс записи вне сетки (например, созданные
    // менеджером вне графика) — чтобы ни одна запись не потерялась из вида.
    const appointmentSlotTimes = selectedAppointments.map((appointment) =>
        formatKazakhstanTime(appointment.dateTime, 'en')
    );
    const daySlots = Array.from(new Set([
        ...generateSlotsFromIntervals(selectedDateIntervals, slotDuration),
        ...appointmentSlotTimes,
    ]))
        .sort((a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0))
        .map((time) => ({ time, isBreak: false }));

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
            </div>
        );
    }

    return (
        <div className='space-y-6 animate-fadeIn'>
            {/* Header */}
            <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-bold text-slate-900'>
                        {t('schedule.title')}
                    </h1>
                    <p className='text-slate-600'>
                        {t('schedule.subtitle')}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <Button variant='outline' onClick={goToToday}>
                        {t('schedule.today')}
                    </Button>
                    <Button
                        onClick={() => setShowSettingsModal(true)}
                        leftIcon={<Clock className='w-4 h-4' />}>
                        {t('schedule.settings_btn')}
                    </Button>
                </div>
            </div>

            {/* Week Navigation */}
            <Card>
                <CardContent className='py-4'>
                    <div className='flex items-center justify-between mb-4'>
                        <button
                            onClick={goToPreviousWeek}
                            className='p-2 hover:bg-slate-100 rounded-lg transition-colors'>
                            <ChevronLeft className='w-5 h-5' />
                        </button>
                        <h2 className='text-lg font-semibold text-slate-900'>
                            {format(weekStart, "d MMMM", { locale: dateLocale })} -{" "}
                            {format(addDays(weekStart, 6), "d MMMM yyyy", {
                                locale: dateLocale,
                            })}
                        </h2>
                        <button
                            onClick={goToNextWeek}
                            className='p-2 hover:bg-slate-100 rounded-lg transition-colors'>
                            <ChevronRight className='w-5 h-5' />
                        </button>
                    </div>

                    {/* Week Calendar */}
                    <div className='grid grid-cols-7 gap-1 sm:gap-2'>
                        {weekDays.map((day, index) => {
                            const dayAppointments = getAppointmentsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = getCalendarDateKey(day) === getKazakhstanDateKey();
                            const isWorking = isWorkingDay(day);
                            const onVacation = Boolean(getDoctorVacationForDate(scheduleDoctor, day));

                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(day)}
                                    className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl text-center transition-all ${
                                        isSelected
                                            ? "bg-teal-600 text-white"
                                            : isToday
                                            ? "bg-teal-50 text-teal-700"
                                            : isWorking
                                            ? "bg-white hover:bg-slate-50"
                                            : "bg-slate-100 text-slate-400"
                                    }`}>
                                    <p className='text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1'>
                                        {format(day, "EEEEEE", { locale: dateLocale })}
                                    </p>
                                    <p
                                        className={`text-base sm:text-lg font-bold ${
                                            isSelected ? "text-white" : ""
                                        }`}>
                                        {format(day, "d")}
                                    </p>
                                    {onVacation && (
                                        <TreePalm
                                            aria-label={t('schedule.vacation_day')}
                                            className={`mx-auto mt-0.5 sm:mt-1 h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                                                isSelected ? "text-white/80" : "text-amber-500"
                                            }`}
                                        />
                                    )}
                                    {dayAppointments.length > 0 && (
                                        <div
                                            className={`mt-0.5 sm:mt-1 text-[10px] sm:text-xs leading-tight ${
                                                isSelected
                                                    ? "text-white/80"
                                                    : "text-teal-600"
                                            }`}>
                                            {dayAppointments.length}
                                            <span className='hidden sm:inline'>{" "}{dayAppointments.length === 1 ? t('schedule.apt_count_1') : t('schedule.apt_count_many')}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className='grid lg:grid-cols-3 gap-6'>
                {/* Day Schedule */}
                <div className='lg:col-span-2'>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {format(selectedDate, "EEEE, d MMMM", {
                                    locale: dateLocale,
                                })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedAppointments.length === 0 &&
                            daySlots.length === 0 ? (
                                <div className='text-center py-12'>
                                    <Calendar className='w-12 h-12 mx-auto text-slate-300 mb-3' />
                                    <p className='text-slate-600'>
                                        {t('schedule.no_appointments')}
                                    </p>
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {daySlots.map(({ time, isBreak }) => {
                                        const appointment =
                                            selectedAppointments.find((a) => {
                                                const aptTime = formatKazakhstanTime(a.dateTime, 'en');
                                                return aptTime === time;
                                            });

                                        return (
                                            <div
                                                key={time}
                                                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-xl min-w-0 ${
                                                    appointment
                                                        ? "bg-teal-50 border border-teal-200"
                                                        : isBreak
                                                        ? "bg-slate-100"
                                                        : "bg-slate-50 hover:bg-slate-100"
                                                }`}>
                                                <div className='w-full sm:w-16 text-center sm:text-center flex-shrink-0'>
                                                    <span className='font-medium text-slate-700 text-sm sm:text-base'>
                                                        {time}
                                                    </span>
                                                </div>
                                                <div className='hidden sm:block w-px h-8 bg-slate-200 flex-shrink-0' />
                                                {appointment ? (
                                                    <div className='flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0 w-full'>
                                                        <div className='flex items-center gap-2 sm:gap-3 min-w-0'>
                                                            <Avatar
                                                                src={getMediaUrl(
                                                                    appointment
                                                                        .patient
                                                                        ?.avatar
                                                                )}
                                                                name={
                                                                    appointment
                                                                        .patient
                                                                        ?.fullName ||
                                                                    t('schedule.patient_label')
                                                                }
                                                                size='sm'
                                                            />
                                                            <div className='min-w-0'>
                                                                <p className='font-medium text-slate-900 text-sm sm:text-base truncate'>
                                                                    {appointment
                                                                        .patient
                                                                        ?.fullName ||
                                                                        t('schedule.patient_label')}
                                                                </p>
                                                                <div className='flex items-center gap-1 text-xs text-slate-500'>
                                                                    {appointment.type ===
                                                                    "video" ? (
                                                                        <Video className='w-3 h-3' />
                                                                    ) : (
                                                                        <MessageCircle className='w-3 h-3' />
                                                                    )}
                                                                    <span className='hidden sm:inline'>{appointment.type === "video" ? t('schedule.type_video') : t('schedule.type_chat')}</span>
                                                                    <span className='sm:hidden'>{appointment.type === "video" ? t('schedule.type_video_short') : t('schedule.type_chat')}</span>
                                                                </div>
                                                                {new Date(appointment.dateTime) > getServerNow() && (
                                                                    <PreparationBadge preparation={appointment.preparation} />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className='flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end'>
                                                            {(() => {
                                                                const now = getServerNow();
                                                                const aptTime = new Date(appointment.dateTime);
                                                                const consultationDuration = doctor?.consultationDuration || doctor?.slotDuration || 30;
                                                                const bufferMinutes = 5;
                                                                const fifteenMinBefore = new Date(aptTime.getTime() - 15 * 60 * 1000);
                                                                const consultationEnd = new Date(aptTime.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000);
                                                                const appointmentStatus = appointment.statuse || appointment.status;
                                                                const canJoin = ['confirmed', 'pending'].includes(appointmentStatus) &&
                                                                    now >= fifteenMinBefore && now <= consultationEnd;
                                                                const isPast = now > consultationEnd || appointmentStatus === 'completed';
                                                                const hasJoinRoom = !!appointment.roomId && !isPast &&
                                                                    ['confirmed', 'pending', 'in_progress'].includes(appointmentStatus);

                                                                return (
                                                                    <>
                                                                        {isPast && appointmentStatus !== 'cancelled' ? (
                                                                            <Badge variant='success'>{t('schedule.status_completed')}</Badge>
                                                                        ) : (
                                                                            <Badge
                                                                                variant={
                                                                                    appointmentStatus === "confirmed"
                                                                                        ? "success"
                                                                                        : appointmentStatus === "pending"
                                                                                        ? "default"
                                                                                        : "danger"
                                                                                }>
                                                                                {appointmentStatus === "confirmed"
                                                                                    ? t('schedule.status_confirmed_short')
                                                                                    : appointmentStatus === "pending"
                                                                                    ? t('schedule.status_pending')
                                                                                    : t('schedule.status_cancelled')}
                                                                            </Badge>
                                                                        )}
                                                                        {hasJoinRoom && (
                                                                            <Link to={`/consultation/${appointment.roomId}`}>
                                                                                <Button size='sm' variant={canJoin ? 'primary' : 'secondary'}>{t('schedule.start_btn')}</Button>
                                                                            </Link>
                                                                        )}
                                                                        {isPast && appointmentStatus !== 'cancelled' && appointment.roomId && (
                                                                            <Link to={getAppointmentDetailsPath(appointment)}>
                                                                                <Button size='sm' variant='secondary'>{t('schedule.details_btn')}</Button>
                                                                            </Link>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                ) : isBreak ? (
                                                    <span className='text-slate-400 w-full sm:w-auto'>
                                                        {t('schedule.break')}
                                                    </span>
                                                ) : (
                                                    <span className='text-slate-400 w-full sm:w-auto'>
                                                        {t('schedule.free')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Day Summary */}
                <div className='space-y-6'>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('schedule.day_stats')}</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.total_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {selectedAppointments.length}
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.video_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {
                                        selectedAppointments.filter(
                                            (a) => a.type === "video"
                                        ).length
                                    }
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.chat_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {
                                        selectedAppointments.filter(
                                            (a) => a.type === "chat"
                                        ).length
                                    }
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-teal-50 rounded-xl'>
                                <span className='text-teal-700'>
                                    {t('schedule.potential_income')}
                                </span>
                                <span className='font-bold text-teal-700'>
                                    {selectedAppointments
                                        .reduce(
                                            (sum, a) =>
                                                sum +
                                                (a.price || doctor?.price || 0),
                                            0
                                        )
                                        .toLocaleString()}{" "}
                                    ₸
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('schedule.working_hours_title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='space-y-3 text-sm'>
                                {selectedDateIntervals.length > 0 ? selectedDateIntervals.map((interval, index) => (
                                    <div key={`${interval.start}-${interval.end}-${index}`} className='flex justify-between gap-3'>
                                        <span className='text-slate-600'>
                                            {t('schedule.interval_label', { number: index + 1 })}
                                        </span>
                                        <span className='font-medium text-right'>
                                            {interval.start} - {interval.end}
                                        </span>
                                    </div>
                                )) : (
                                    <p className='text-slate-500'>
                                        {selectedDateVacation
                                            ? t('schedule.vacation_until', {
                                                  date: format(parseISO(selectedDateVacation.to), "d MMMM", { locale: dateLocale }),
                                              })
                                            : t('schedule.day_off')}
                                    </p>
                                )}
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        {t('schedule.slot_duration_label')}
                                    </span>
                                    <span className='font-medium'>
                                        {slotDuration} {t('schedule.min_abbr')}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Settings Modal */}
            <DoctorScheduleModal
                doctor={doctor}
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onSaved={fetchDoctorAndAppointments}
            />
        </div>
    );
}

export default DoctorSchedule;
