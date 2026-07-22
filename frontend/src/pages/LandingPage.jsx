import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    Video,
    Shield,
    Clock,
    Star,
    ArrowRight,
    CheckCircle,
    Calendar,
    MessageCircle,
    FileText,
    Heart,
    Brain,
    Stethoscope,
    Users,
    Award,
    Zap,
    Phone,
    Mail,
    MapPin,
    Play,
    Pause,
    HeartPulse,
    UserCheck,
    Headphones,
    ThumbsUp,
    ChevronLeft,
    Send,
    ExternalLink,
    Activity,
    ScanLine,
    Syringe,
    Venus,
} from "lucide-react";
import Button from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import PriceListSection from "../components/pricing/PriceListSection";
import {
    contentAPI,
    doctorsAPI,
    getMediaUrl,
    normalizeResponse,
} from "../services/api";
import { cn, getInitials, isDoctorOnline, getSpecName } from "../utils/helpers";
import { DEFAULT_CONTENT_LOCALE } from "../utils/locales";
import { SHOW_DOCTOR_PRICES } from "../utils/constants";
import { TREATMENT_DEPARTMENTS, localizeDepartment, mergeTreatmentDepartments } from "../data/treatmentDepartments";

const doctorCardColors = [
    "bg-gradient-to-br from-teal-400 to-teal-600",
    "bg-gradient-to-br from-sky-400 to-sky-600",
    "bg-gradient-to-br from-violet-400 to-violet-600",
    "bg-gradient-to-br from-rose-400 to-rose-600",
    "bg-gradient-to-br from-amber-400 to-amber-600",
    "bg-gradient-to-br from-emerald-400 to-emerald-600",
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
];

const featureIcons = [Video, Shield, Clock, FileText];
const advantageIcons = [HeartPulse, UserCheck, Headphones];

const treatmentIcons = { Activity, Brain, Heart, HeartPulse, ScanLine, Stethoscope, Syringe, Venus };

function mergeLandingConfig(base, incoming) {
    return {
        ...base,
        ...(incoming || {}),
        hero: { ...base.hero, ...(incoming?.hero || {}) },
        heroCard: {
            ...base.heroCard,
            ...(incoming?.heroCard || {}),
            items: Array.isArray(incoming?.heroCard?.items) && incoming.heroCard.items.length > 0
                ? incoming.heroCard.items
                : base.heroCard.items,
        },
        stats: Array.isArray(incoming?.stats) && incoming.stats.length > 0 ? incoming.stats : base.stats,
        featuresSection: {
            ...base.featuresSection,
            ...(incoming?.featuresSection || {}),
            cards: Array.isArray(incoming?.featuresSection?.cards) && incoming.featuresSection.cards.length > 0
                ? incoming.featuresSection.cards
                : base.featuresSection.cards,
        },
        stepsSection: {
            ...base.stepsSection,
            ...(incoming?.stepsSection || {}),
            steps: Array.isArray(incoming?.stepsSection?.steps) && incoming.stepsSection.steps.length > 0
                ? incoming.stepsSection.steps
                : base.stepsSection.steps,
        },
        aboutSection: {
            ...base.aboutSection,
            ...(incoming?.aboutSection || {}),
            bullets: Array.isArray(incoming?.aboutSection?.bullets) && incoming.aboutSection.bullets.length > 0
                ? incoming.aboutSection.bullets
                : base.aboutSection.bullets,
        },
        contactSection: {
            ...base.contactSection,
            ...(incoming?.contactSection || {}),
            phone: { ...base.contactSection.phone, ...(incoming?.contactSection?.phone || {}) },
            email: { ...base.contactSection.email, ...(incoming?.contactSection?.email || {}) },
            address: { ...base.contactSection.address, ...(incoming?.contactSection?.address || {}) },
            quickCard: {
                ...base.contactSection.quickCard,
                ...(incoming?.contactSection?.quickCard || {}),
                bullets:
                    Array.isArray(incoming?.contactSection?.quickCard?.bullets) && incoming.contactSection.quickCard.bullets.length > 0
                        ? incoming.contactSection.quickCard.bullets
                        : base.contactSection.quickCard.bullets,
            },
        },
    };
}

// Doctors Carousel Component
function DoctorsCarousel({ doctors }) {
    const { t, i18n } = useTranslation();
    const carouselRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const touchStartX = useRef(null);
    const [cardsPerPage, setCardsPerPage] = useState(4);

    useEffect(() => {
        const updateCardsPerPage = () => {
            const width = window.innerWidth;
            if (width < 640) setCardsPerPage(1);
            else if (width < 1024) setCardsPerPage(2);
            else setCardsPerPage(4);
        };
        updateCardsPerPage();
        window.addEventListener('resize', updateCardsPerPage);
        return () => window.removeEventListener('resize', updateCardsPerPage);
    }, []);

    const totalPages = Math.ceil(doctors.length / cardsPerPage);
    const safeCurrentPage = totalPages > 0 ? currentPage % totalPages : 0;

    useEffect(() => {
        if (totalPages <= 1 || isHovered) return;
        const interval = setInterval(() => {
            setCurrentPage((prev) => (prev + 1) % totalPages);
        }, 3000);
        return () => clearInterval(interval);
    }, [totalPages, isHovered]);

    useEffect(() => {
        if (!carouselRef.current) return;
        const pageWidth = carouselRef.current.clientWidth;
        carouselRef.current.scrollTo({
            left: pageWidth * safeCurrentPage,
            behavior: "smooth",
        });
    }, [safeCurrentPage]);

    const goToPage = (page) => setCurrentPage(page);
    const goNext = () => setCurrentPage((prev) => (prev + 1) % totalPages);
    const goPrev = () =>
        setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);

    const getYearWord = (years) => {
        if (years === 1) return t('common.year_1');
        if (years >= 2 && years <= 4) return t('common.year_2_4');
        return t('common.year_many');
    };

    return (
        <section className='py-24 bg-gradient-to-b from-slate-50 to-white'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex flex-col sm:flex-row items-center justify-between mb-12 gap-4'>
                    <div className='text-center sm:text-left'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.doctors.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-2'>
                            {t('landing.doctors.title')}
                        </h2>
                        <p className='text-slate-600'>
                            {t('landing.doctors.subtitle')}
                        </p>
                    </div>
                    <div className='flex items-center gap-3'>
                        {totalPages > 1 && (
                            <>
                                <button
                                    onClick={goPrev}
                                    className='w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 transition-colors'>
                                    <ChevronLeft className='w-5 h-5' />
                                </button>
                                <button
                                    onClick={goNext}
                                    className='w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 transition-colors'>
                                    <ArrowRight className='w-5 h-5' />
                                </button>
                            </>
                        )}
                        <Link to='/doctors'>
                            <Button
                                variant='outline'
                                rightIcon={<ArrowRight className='w-4 h-4' />}>
                                {t('landing.doctors.all_doctors')}
                            </Button>
                        </Link>
                    </div>
                </div>

                <div
                    className='relative'
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    <div
                        ref={carouselRef}
                        className='overflow-hidden scroll-smooth'
                        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => {
                            if (touchStartX.current === null) return;
                            const diff = touchStartX.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 50) {
                                if (diff > 0) goNext();
                                else goPrev();
                            }
                            touchStartX.current = null;
                        }}>
                        <div
                            className='flex'
                            style={{ width: `${totalPages * 100}%` }}>
                            {doctors.map((doctor) => {
                                const specName = getSpecName(doctor.specialization, i18n.language)
                                    || t('common.specialist');
                                const photoUrl = getMediaUrl(doctor.photo);
                                const initials = getInitials(doctor.fullName);
                                const colorIndex = doctor.fullName
                                    ? doctor.fullName.charCodeAt(0) % doctorCardColors.length
                                    : 0;
                                const bgColor = doctorCardColors[colorIndex];
                                const rating = Math.min(doctor.rating || 0, 5);
                                const reviewsCount = doctor.reviewsCount || 0;
                                const experience = doctor.experience || 0;
                                const isOnline = isDoctorOnline(doctor);
                                const recommendPercent =
                                    reviewsCount > 0
                                        ? Math.min(95 + Math.floor(rating), 100)
                                        : null;

                                return (
                                    <div
                                        key={doctor.id || doctor.documentId}
                                        className='px-3'
                                        style={{
                                            width: `${100 / (totalPages * cardsPerPage)}%`,
                                        }}>
                                        <Link
                                            to={`/doctors/${doctor.documentId || doctor.id}`}
                                            className='group block h-full'>
                                            <div className='bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 h-full flex flex-col'>
                                                <div className='relative'>
                                                    <div className='aspect-square sm:aspect-[4/5] overflow-hidden bg-slate-100'>
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={doctor.fullName}
                                                                className='w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105'
                                                            />
                                                        ) : (
                                                            <div
                                                                className={cn(
                                                                    "w-full h-full flex items-center justify-center text-white text-4xl font-bold",
                                                                    bgColor,
                                                                )}>
                                                                {initials}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isOnline && (
                                                        <span className='absolute bottom-3 right-3 px-2.5 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center gap-1.5 shadow-lg'>
                                                            <span className='w-1.5 h-1.5 bg-white rounded-full animate-pulse' />
                                                            {t('common.online')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className='p-5 flex flex-col flex-1'>
                                                    <div className='mb-3'>
                                                        <h3 className='text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors line-clamp-1'>
                                                            {doctor.fullName}
                                                        </h3>
                                                        <p className='text-teal-600 font-medium text-sm'>
                                                            {specName}
                                                        </p>
                                                    </div>

                                                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1 mb-3'>
                                                        <div className='flex items-center gap-1'>
                                                            <Star className='w-4 h-4 text-amber-400 fill-amber-400' />
                                                            <span className='font-semibold text-slate-900'>
                                                                {rating.toFixed(1)}
                                                            </span>
                                                            <span className='text-slate-500 text-sm'>
                                                                ({reviewsCount})
                                                            </span>
                                                        </div>
                                                        <div className='flex items-center gap-1 text-slate-600 text-sm'>
                                                            <Clock className='w-4 h-4' />
                                                            <span>
                                                                {experience}{" "}
                                                                {getYearWord(experience)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className='h-6 mb-3'>
                                                        {recommendPercent && (
                                                            <div className='flex items-center gap-1.5'>
                                                                <ThumbsUp className='w-4 h-4 text-emerald-500' />
                                                                <span className='text-sm text-emerald-600 font-medium'>
                                                                    {recommendPercent}{t('common.recommend_pct')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {SHOW_DOCTOR_PRICES && (
                                                        <div className='flex items-center justify-between pt-4 border-t border-slate-100 mt-auto'>
                                                            <div>
                                                                <p className='text-xl font-bold text-slate-900'>
                                                                    {(doctor.price || 0).toLocaleString("ru-RU")}{" "}
                                                                    {t('common.currency')}
                                                                </p>
                                                                <p className='text-xs text-slate-500'>
                                                                    {t('common.price_per_consultation')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className='flex items-center justify-center gap-2 mt-8'>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToPage(i)}
                                className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    safeCurrentPage === i
                                        ? "w-8 bg-teal-500"
                                        : "w-2 bg-slate-300 hover:bg-slate-400",
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function LandingPage() {
    const { t, i18n } = useTranslation();
    const [doctors, setDoctors] = useState([]);
    const [treatmentDepartments, setTreatmentDepartments] = useState(TREATMENT_DEPARTMENTS);
    const [storedLandingConfig, setStoredLandingConfig] = useState(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );

    const heroRef = useRef(null);
    const videoRef = useRef(null);
    const cardRef = useRef(null);
    const [cardTransform, setCardTransform] = useState({
        rotateX: 0,
        rotateY: 0,
        scale: 1,
    });

    const defaultLandingConfig = useMemo(() => ({
        hero: {
            badge: t('landing.hero.badge'),
            titlePrefix: t('landing.hero.title_prefix'),
            titleHighlight: t('landing.hero.title_highlight'),
            description: t('landing.hero.description'),
            primaryButtonLabel: t('landing.hero.find_doctor'),
            secondaryButtonLabel: t('landing.hero.register'),
        },
        heroCard: {
            title: t('landing.hero_card.title'),
            subtitle: t('landing.hero_card.subtitle'),
            items: [
                { title: t('landing.hero_card.item_0_title'), description: t('landing.hero_card.item_0_desc') },
                { title: t('landing.hero_card.item_1_title'), description: t('landing.hero_card.item_1_desc') },
                { title: t('landing.hero_card.item_2_title'), description: t('landing.hero_card.item_2_desc') },
            ],
            buttonLabel: t('landing.hero_card.book_now'),
        },
        stats: [
            { value: "1100+", label: t('landing.stats.consultations') },
            { value: "3", label: t('landing.stats.doctors') },
            { value: "<2h", label: t('landing.stats.avg_rating') },
            { value: "24/7", label: t('landing.stats.satisfaction') },
        ],
        featuresSection: {
            badge: t('landing.features.badge'),
            title: t('landing.features.title'),
            subtitle: t('landing.features.subtitle'),
            cards: [
                { title: t('landing.features.card_0_title'), description: t('landing.features.card_0_desc') },
                { title: t('landing.features.card_1_title'), description: t('landing.features.card_1_desc') },
                { title: t('landing.features.card_2_title'), description: t('landing.features.card_2_desc') },
                { title: t('landing.features.card_3_title'), description: t('landing.features.card_3_desc') },
            ],
        },
        stepsSection: {
            badge: t('landing.steps.badge'),
            title: t('landing.steps.title'),
            subtitle: t('landing.steps.subtitle'),
            steps: [
                { title: t('landing.steps.step_0_title'), description: t('landing.steps.step_0_desc') },
                { title: t('landing.steps.step_1_title'), description: t('landing.steps.step_1_desc') },
                { title: t('landing.steps.step_2_title'), description: t('landing.steps.step_2_desc') },
                { title: t('landing.steps.step_3_title'), description: t('landing.steps.step_3_desc') },
            ],
        },
        aboutSection: {
            badge: t('landing.about.badge'),
            title: t('landing.about.title'),
            description: t('landing.about.description'),
            bullets: [
                t('landing.about.bullet_0'),
                t('landing.about.bullet_1'),
                t('landing.about.bullet_2'),
                t('landing.about.bullet_3'),
            ],
            buttonLabel: t('landing.about.join'),
        },
        contactSection: {
            badge: t('landing.contact.badge'),
            title: t('landing.contact.title'),
            subtitle: t('landing.contact.subtitle'),
            phone: {
                title: t('landing.contact.phone_title'),
                note: t('landing.contact.phone_note'),
                value: "+7 (717) 270-12-34",
            },
            email: {
                title: t('landing.contact.email_title'),
                note: t('landing.contact.email_note'),
                value: "info@medtour.kz",
            },
            address: {
                title: t('landing.contact.address_title'),
                note: t('landing.contact.address_note'),
                value: t('footer.address'),
            },
            quickCard: {
                title: t('landing.contact.quick_title'),
                description: t('landing.contact.quick_desc'),
                bullets: [
                    t('landing.contact.quick_bullet_0'),
                    t('landing.contact.quick_bullet_1'),
                    t('landing.contact.quick_bullet_2'),
                ],
                buttonLabel: t('landing.contact.quick_button'),
            },
            mapEmbedUrl:
                "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2505.5!2d71.4926513!3d51.1492038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4245817a521995c9%3A0xe653c982ba77912!2z0J3QsNGG0LjQvtC90LDQu9GM0L3Ri9C5INC90LDRg9GH0L3Ri9C5INC80LXQtNC40YbQuNC90YHQutC40Lkg0YbQtdC90YLRgA!5e0!3m2!1sru!2skz!4v1700000000000!5m2!1sru!2skz",
        },
    }), [t]);

    const testimonials = useMemo(() => {
        const names = i18n.language === 'ru'
            ? [
                { name: "Айгерим К.", avatar: "АК" },
                { name: "Арман Б.", avatar: "АБ" },
                { name: "Динара М.", avatar: "ДМ" },
            ]
            : [
                { name: "Aigerim K.", avatar: "AK" },
                { name: "Arman B.", avatar: "AB" },
                { name: "Dinara M.", avatar: "DM" },
            ];

        return names.map((item, index) => ({
            ...item,
            text: t(`landing.testimonials.review_${index}`),
            rating: 5,
        }));
    }, [t, i18n.language]);

    const handleCardMouseMove = (e) => {
        if (!cardRef.current || prefersReducedMotion) return;
        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;
        const rotateY = (mouseX / (rect.width / 2)) * 12;
        const rotateX = -(mouseY / (rect.height / 2)) * 12;
        setCardTransform({ rotateX, rotateY, scale: 1.02 });
    };

    const handleCardMouseLeave = () => {
        setCardTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    };

    const handleHeroPointerMove = (event) => {
        if (!heroRef.current || prefersReducedMotion) return;
        const rect = heroRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        heroRef.current.style.setProperty("--hero-shift-x", `${x * -8}px`);
        heroRef.current.style.setProperty("--hero-shift-y", `${y * -6}px`);
        heroRef.current.style.setProperty("--hero-glow-x", `${50 + x * 12}%`);
        heroRef.current.style.setProperty("--hero-glow-y", `${45 + y * 10}%`);
    };

    const handleHeroPointerLeave = () => {
        if (!heroRef.current) return;
        heroRef.current.style.setProperty("--hero-shift-x", "0px");
        heroRef.current.style.setProperty("--hero-shift-y", "0px");
        heroRef.current.style.setProperty("--hero-glow-x", "50%");
        heroRef.current.style.setProperty("--hero-glow-y", "45%");
    };

    const toggleHeroVideo = async () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            try {
                await videoRef.current.play();
            } catch {
                setIsVideoPlaying(false);
            }
        } else {
            videoRef.current.pause();
        }
    };

    useEffect(() => {
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handleMotionPreference = () => {
            setPrefersReducedMotion(motionPreference.matches);
            if (motionPreference.matches) videoRef.current?.pause();
        };

        motionPreference.addEventListener?.("change", handleMotionPreference);
        return () => motionPreference.removeEventListener?.("change", handleMotionPreference);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const [doctorsResult, globalResult] = await Promise.allSettled([
                doctorsAPI.getAll(),
                contentAPI.getGlobal(),
            ]);

            if (doctorsResult.status === 'fulfilled') {
                const doctorsRes = doctorsResult.value;
                const { data: doctorsData } = normalizeResponse(doctorsRes);
                setDoctors(doctorsData?.slice(0, 8) || []);
            } else {
                console.error("Error fetching landing doctors:", doctorsResult.reason);
            }

            if (globalResult.status === 'fulfilled') {
                const { data: globalData } = normalizeResponse(globalResult.value);
                setStoredLandingConfig(globalData?.landingConfig || null);
                setTreatmentDepartments(mergeTreatmentDepartments(globalData?.treatmentDepartments));
            } else {
                console.error("Error fetching landing content:", globalResult.reason);
                setStoredLandingConfig(null);
            }
        };

        fetchData();
    }, []);

    const config = useMemo(() => {
        const localizedConfig =
            storedLandingConfig?.i18n?.[i18n.language] ||
            (
                i18n.language === DEFAULT_CONTENT_LOCALE && storedLandingConfig?.hero
                    ? storedLandingConfig
                    : null
            );

        return mergeLandingConfig(defaultLandingConfig, localizedConfig);
    }, [defaultLandingConfig, storedLandingConfig, i18n.language]);

    return (
        <div className='overflow-hidden'>
            {/* Hero Section */}
            <section
                ref={heroRef}
                className='hero-stage relative min-h-screen min-h-[100svh] flex items-center'
                onPointerMove={handleHeroPointerMove}
                onPointerLeave={handleHeroPointerLeave}>
                <div className='absolute inset-0 overflow-hidden bg-slate-950'>
                    <div
                        className='hero-poster absolute inset-0 bg-cover bg-center'
                        style={{ backgroundImage: "url('/medtour-clinic-poster.jpg')" }}
                    />
                    <video
                        ref={videoRef}
                        className={cn("hero-video absolute inset-0 w-full h-full object-cover", isVideoReady && "is-ready")}
                        autoPlay={!prefersReducedMotion}
                        muted
                        loop
                        playsInline
                        preload='metadata'
                        poster='/medtour-clinic-poster.jpg'
                        onCanPlay={() => setIsVideoReady(true)}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        aria-hidden='true'>
                        <source src='/medtour-clinic-hero.mp4' type='video/mp4' />
                    </video>
                    <div className='hero-color-wash absolute inset-0' />
                    <div className='absolute inset-0 bg-gradient-to-r from-slate-950/95 via-teal-950/72 to-slate-950/15' />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20' />
                    <div className='hero-grid absolute inset-0 opacity-30' />
                </div>

                <div className='absolute inset-0 overflow-hidden pointer-events-none'>
                    <div className='hero-ambient-orb absolute top-20 left-[38%] w-72 h-72 bg-teal-300/10 rounded-full blur-3xl' />
                    <div className='hero-ambient-orb hero-ambient-orb-delayed absolute bottom-16 right-16 w-96 h-96 bg-sky-300/10 rounded-full blur-3xl' />
                </div>

                <div className='hero-reveal hero-delay-5 hidden lg:flex absolute top-28 right-8 xl:right-14 z-10 items-center gap-3 rounded-full border border-white/15 bg-slate-950/35 px-4 py-2.5 text-white shadow-xl backdrop-blur-md'>
                    <span className='relative flex h-2.5 w-2.5'>
                        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70' />
                        <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400' />
                    </span>
                    <div>
                        <p className='text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55'>
                            {t('landing.hero.video_kicker')}
                        </p>
                        <p className='flex items-center gap-1.5 text-sm font-medium'>
                            <MapPin className='h-3.5 w-3.5 text-teal-300' />
                            {t('landing.hero.video_location')}
                        </p>
                    </div>
                </div>

                <div className='relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-36'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='hero-reveal hero-delay-1 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium mb-6 backdrop-blur-sm border border-white/20 shadow-lg shadow-slate-950/10'>
                                <Zap className='w-4 h-4 text-amber-400' />
                                {config.hero.badge}
                            </span>
                            <h1 className='hero-reveal hero-delay-2 text-4xl sm:text-5xl lg:text-6xl xl:text-[4.25rem] font-bold leading-[1.08] mb-6 max-w-3xl text-balance'>
                                {config.hero.titlePrefix}{" "}
                                <span className='hero-gradient-text text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-white to-cyan-200'>
                                    {config.hero.titleHighlight}
                                </span>
                            </h1>
                            <p className='hero-reveal hero-delay-3 text-lg sm:text-xl text-white/78 mb-8 max-w-xl leading-relaxed text-balance'>
                                {config.hero.description}
                            </p>
                            <div className='hero-reveal hero-delay-4 flex flex-col sm:flex-row gap-4'>
                                <Link to='/register'>
                                    <Button variant='inverse' size='lg' className='w-full sm:w-auto group font-semibold shadow-xl shadow-slate-950/20'>
                                        {config.hero.primaryButtonLabel}
                                        <ArrowRight className='w-5 h-5 ml-2 transition-transform group-hover:translate-x-1' />
                                    </Button>
                                </Link>
                                <Link to='/register'>
                                    <Button variant='ghost' size='lg' className='w-full sm:w-auto border border-white/20 bg-white/10 text-white hover:bg-white/18 hover:text-white shadow-lg backdrop-blur-sm font-semibold'>
                                        {config.hero.secondaryButtonLabel}
                                    </Button>
                                </Link>
                            </div>

                            <div className='hero-reveal hero-delay-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 mt-10 pt-8 border-t border-white/18'>
                                {(config.stats || []).slice(0, 4).map((item, idx) => (
                                    <div key={idx}>
                                        <div className='text-3xl font-bold text-white'>{item.value}</div>
                                        <div className='text-sm text-white/58'>{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3D Floating Card */}
                        <div className='hero-reveal hero-delay-4 hidden lg:block relative ml-auto w-full max-w-md' style={{ perspective: "1200px" }}>
                            <div className='absolute -inset-10 bg-teal-400/12 rounded-full blur-3xl' />
                            <div className='hero-card-float'>
                                <div
                                    ref={cardRef}
                                    onMouseMove={handleCardMouseMove}
                                    onMouseLeave={handleCardMouseLeave}
                                    className='relative'
                                    style={{
                                        transform: `rotateX(${cardTransform.rotateX}deg) rotateY(${cardTransform.rotateY}deg) scale(${cardTransform.scale})`,
                                        transition: "transform 0.18s ease-out",
                                        transformStyle: "preserve-3d",
                                    }}>
                                    <Card className='relative bg-white/86 backdrop-blur-xl shadow-2xl shadow-slate-950/30 border border-white/55 overflow-hidden ring-1 ring-slate-900/5'>
                                    <div
                                        className='absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none'
                                        style={{
                                            background: `linear-gradient(${105 + cardTransform.rotateY * 2}deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)`,
                                        }}
                                    />
                                    <CardContent className='p-8'>
                                        <div className='flex items-center gap-4 mb-6'>
                                            <div className='w-16 h-16 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg' style={{ transform: "translateZ(30px)" }}>
                                                <Video className='w-8 h-8 text-white' />
                                            </div>
                                            <div style={{ transform: "translateZ(20px)" }}>
                                                <h3 className='text-lg font-semibold text-slate-900'>{config.heroCard.title}</h3>
                                                <p className='text-slate-500'>{config.heroCard.subtitle}</p>
                                            </div>
                                        </div>

                                        <div className='space-y-4 mb-6'>
                                            {(config.heroCard.items || []).slice(0, 3).map((adv, idx) => {
                                                const AdvantageIcon = advantageIcons[idx] || advantageIcons[0];
                                                return (
                                                    <div key={idx} className='flex items-center gap-3' style={{ transform: `translateZ(${15 - idx * 3}px)` }}>
                                                        <div className='w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                                                            <AdvantageIcon className='w-5 h-5 text-teal-600' />
                                                        </div>
                                                        <div>
                                                            <p className='font-medium text-slate-900 text-sm'>{adv.title}</p>
                                                            <p className='text-xs text-slate-500'>{adv.description}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <Link to='/register' className='block' style={{ transform: "translateZ(25px)" }}>
                                            <Button className='w-full'>{config.heroCard.buttonLabel}</Button>
                                        </Link>
                                    </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <a href='#features' className='hero-scroll-cue absolute bottom-7 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center text-center'>
                    <span className='text-white/60 text-sm mb-2'>{t('landing.hero.scroll_more')}</span>
                    <div className='w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-1'>
                        <div className='hero-scroll-dot w-1.5 h-3 bg-white/70 rounded-full' />
                    </div>
                </a>

                <button
                    type='button'
                    onClick={toggleHeroVideo}
                    className='absolute top-20 right-4 lg:top-auto lg:bottom-6 lg:right-20 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-950/35 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-slate-950/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                    aria-label={isVideoPlaying ? t('landing.hero.pause_video') : t('landing.hero.play_video')}
                    title={isVideoPlaying ? t('landing.hero.pause_video') : t('landing.hero.play_video')}>
                    {isVideoPlaying ? <Pause className='h-4 w-4 fill-current' /> : <Play className='h-4 w-4 fill-current translate-x-px' />}
                </button>
            </section>

            {/* Features Section */}
            <section id='features' className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {config.featuresSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.featuresSection.title}
                        </h2>
                        <p className='text-xl text-slate-600 max-w-2xl mx-auto'>
                            {config.featuresSection.subtitle}
                        </p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {(config.featuresSection.cards || []).slice(0, 4).map((feature, index) => {
                            const FeatureIcon = featureIcons[index] || featureIcons[0];
                            return (
                                <Card key={index} hover className='text-center border-0 shadow-lg shadow-slate-200/50'>
                                    <CardContent className='pt-8'>
                                        <div className='w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30'>
                                            <FeatureIcon className='w-8 h-8 text-white' />
                                        </div>
                                        <h3 className='text-lg font-semibold text-slate-900 mb-2'>{feature.title}</h3>
                                        <p className='text-slate-600'>{feature.description}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Treatment Departments Section */}
            <section id='specializations' className='py-24 bg-gradient-to-b from-slate-50 to-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.specializations.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {t('landing.specializations.title')}
                        </h2>
                        <p className='text-xl text-slate-600'>
                            {t('landing.specializations.subtitle')}
                        </p>
                    </div>

                    <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                        {treatmentDepartments.map((department) => {
                            const item = localizeDepartment(department, i18n.language);
                            const IconComponent = treatmentIcons[department.icon] || Stethoscope;
                            return (
                                <Link key={department.slug} to={`/treatments/${department.slug}`} className='group'>
                                    <Card hover className='h-full text-left transition-all group-hover:border-teal-400 group-hover:shadow-xl group-hover:-translate-y-1'>
                                        <CardContent className='h-full p-7 flex flex-col'>
                                            <div className='flex items-start justify-between gap-4'>
                                                <div className='w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center group-hover:bg-teal-500 transition-colors'>
                                                    <IconComponent className='w-7 h-7 text-teal-600 group-hover:text-white transition-colors' />
                                                </div>
                                                <ArrowRight className='w-5 h-5 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-1 transition-all' />
                                            </div>
                                            <h3 className='mt-6 text-lg font-semibold text-slate-900 group-hover:text-teal-700 transition-colors'>
                                                {item.displayTitle}
                                            </h3>
                                            <p className='mt-2 text-sm leading-6 text-slate-500'>{item.displayShort}</p>
                                            <p className='mt-auto pt-5 text-xs font-semibold uppercase tracking-wider text-teal-700'>
                                                {(item.programs || []).length} {i18n.language === 'en' ? 'programs' : i18n.language === 'kk' ? 'бағдарлама' : 'программ'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>

                    <div className='text-center mt-12'>
                        <Link to='/register'>
                            <Button variant='outline' size='lg' rightIcon={<ArrowRight className='w-5 h-5' />}>
                                {t('landing.specializations.all_specs')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id='process' className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {config.stepsSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.stepsSection.title}
                        </h2>
                        <p className='text-xl text-slate-600'>{config.stepsSection.subtitle}</p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {(config.stepsSection.steps || []).slice(0, 4).map((step, index) => (
                            <div key={index} className='relative text-center lg:text-left'>
                                <div className='text-7xl font-bold text-teal-100 mb-4'>
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <h3 className='text-xl font-semibold text-slate-900 mb-2'>{step.title}</h3>
                                <p className='text-slate-600'>{step.description}</p>
                                {index < (config.stepsSection.steps || []).slice(0, 4).length - 1 && (
                                    <ArrowRight className='hidden lg:block absolute top-8 -right-4 w-8 h-8 text-teal-300' />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Top Doctors Carousel */}
            {doctors.length > 0 && <DoctorsCarousel doctors={doctors} />}

            <PriceListSection
                featuredOnly
                limit={6}
                showCta
                ctaTo='/prices'
                ctaLabel={t('pricing.view_all')}
            />

            {/* Testimonials */}
            <section className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.testimonials.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {t('landing.testimonials.title')}
                        </h2>
                        <p className='text-xl text-slate-600'>{t('landing.testimonials.subtitle')}</p>
                    </div>

                    <div className='grid md:grid-cols-3 gap-8'>
                        {testimonials.map((testimonial, idx) => (
                            <Card key={idx} className='border-0 shadow-lg'>
                                <CardContent className='p-8'>
                                    <div className='flex items-center gap-1 mb-4'>
                                        {[...Array(testimonial.rating)].map((_, i) => (
                                            <Star key={i} className='w-5 h-5 text-amber-400 fill-amber-400' />
                                        ))}
                                    </div>
                                    <p className='text-slate-600 mb-6 italic'>"{testimonial.text}"</p>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold'>
                                            {testimonial.avatar}
                                        </div>
                                        <p className='font-medium text-slate-900'>{testimonial.name}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id='about' className='py-24 bg-gradient-to-br from-teal-600 to-sky-700'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='inline-block px-4 py-1 bg-white/20 text-white rounded-full text-sm font-medium mb-6'>
                                {config.aboutSection.badge}
                            </span>
                            <h2 className='text-3xl sm:text-4xl font-bold mb-6'>{config.aboutSection.title}</h2>
                            <p className='text-white/80 text-lg mb-6 leading-relaxed'>{config.aboutSection.description}</p>
                            <div className='space-y-4 mb-8'>
                                {(config.aboutSection.bullets || []).map((item, idx) => (
                                    <div className='flex items-center gap-3' key={idx}>
                                        <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                        <span className='text-white/90'>{item}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to='/register'>
                                <Button size='lg' className='text-teal-700 hover:bg-teal-50'>
                                    {config.aboutSection.buttonLabel}
                                    <ArrowRight className='w-5 h-5 ml-2' />
                                </Button>
                            </Link>
                        </div>
                        <div className='hidden lg:block'>
                            <div className='grid grid-cols-2 gap-6'>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Users className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[0]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[0]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Award className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[2]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[2]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Stethoscope className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[1]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[1]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Heart className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[3]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[3]?.label}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id='contact' className='py-24 bg-slate-50'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {config.contactSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.contactSection.title}
                        </h2>
                        <p className='text-xl text-slate-600 max-w-2xl mx-auto'>
                            {config.contactSection.subtitle}
                        </p>
                    </div>

                    <div className='grid lg:grid-cols-3 gap-8 mb-12'>
                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-500 transition-colors'>
                                <Phone className='w-7 h-7 text-teal-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.phone.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.phone.note}</p>
                            <a
                                href={`tel:${(config.contactSection.phone.value || "").replace(/\s+/g, "").replace(/[()\\-]/g, "")}`}
                                className='text-xl font-semibold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.phone.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-500 transition-colors'>
                                <Mail className='w-7 h-7 text-sky-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.email.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.email.note}</p>
                            <a
                                href={`mailto:${config.contactSection.email.value}`}
                                className='text-xl font-semibold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.email.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-violet-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-500 transition-colors'>
                                <MapPin className='w-7 h-7 text-violet-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.address.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.address.note}</p>
                            <p className='text-xl font-semibold text-violet-600'>{config.contactSection.address.value}</p>
                        </div>
                    </div>

                    <div className='grid lg:grid-cols-5 gap-8'>
                        <div className='lg:col-span-3 rounded-2xl overflow-hidden shadow-lg border border-slate-200 min-h-[320px]'>
                            <iframe
                                title='MedTour Location'
                                src={config.contactSection.mapEmbedUrl}
                                width='100%'
                                height='100%'
                                style={{ border: 0, minHeight: "320px" }}
                                allowFullScreen=''
                                loading='lazy'
                                referrerPolicy='no-referrer-when-downgrade'
                                className='w-full h-full'
                            />
                        </div>

                        <div className='lg:col-span-2 bg-gradient-to-br from-teal-600 to-sky-700 rounded-2xl p-8 text-white flex flex-col justify-between'>
                            <div>
                                <h3 className='text-2xl font-bold mb-4'>{config.contactSection.quickCard.title}</h3>
                                <p className='text-white/80 mb-6 leading-relaxed'>{config.contactSection.quickCard.description}</p>
                                <div className='space-y-3 mb-8'>
                                    {(config.contactSection.quickCard.bullets || []).map((item, idx) => (
                                        <div className='flex items-center gap-3' key={idx}>
                                            <CheckCircle className='w-5 h-5 text-teal-300 flex-shrink-0' />
                                            <span className='text-white/90 text-sm'>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Link to='/register'>
                                <Button
                                    size='lg'
                                    className='w-full text-teal-700 hover:bg-teal-50 shadow-lg'
                                    rightIcon={<Send className='w-5 h-5' />}>
                                    {config.contactSection.quickCard.buttonLabel}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className='py-24 bg-white'>
                <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
                    <div className='bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 shadow-2xl'>
                        <Award className='w-16 h-16 mx-auto mb-6 text-teal-400' />
                        <h2 className='text-3xl sm:text-4xl font-bold mb-4 text-white'>
                            {t('landing.cta.title')}
                        </h2>
                        <p className='text-xl text-slate-300 mb-8 max-w-2xl mx-auto'>
                            {t('landing.cta.description')}
                        </p>
                        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                            <Link to='/register'>
                                <Button size='lg' className='bg-teal-500 hover:bg-teal-600 text-white shadow-lg'>
                                    {t('landing.cta.register')}
                                </Button>
                            </Link>
                            <a href='#contact'>
                                <Button size='lg' className='bg-white/20 backdrop-blur border-2 border-white/50 text-white hover:bg-white/30'>
                                    {t('landing.cta.view_doctors')}
                                </Button>
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default LandingPage;
