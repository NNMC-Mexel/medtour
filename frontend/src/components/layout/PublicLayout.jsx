import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    Menu,
    X,
    Phone,
    Mail,
    MapPin,
    ChevronDown,
    UserCircle,
    Stethoscope,
} from "lucide-react";
import { cn } from "../../utils/helpers";
import Button from "../ui/Button";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import useAuthStore from "../../stores/authStore";
import PatientChatWidget from "../chat/PatientChatWidget";
import BrandLogo from "../ui/BrandLogo";

function PublicLayout() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuthStore();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const loginDropdownRef = useRef(null);
    const lang = i18n.language?.split('-')?.[0] || 'ru';
    const footerTreatments = {
        ru: ['Институт сердца', 'Нейрохирургия', 'Check-up', 'Все направления'],
        en: ['Heart Institute', 'Neurosurgery', 'Check-up', 'All specialties'],
        kk: ['Жүрек институты', 'Нейрохирургия', 'Check-up', 'Барлық бағыттар'],
    }[lang] || ['Институт сердца', 'Нейрохирургия', 'Check-up', 'Все направления'];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                loginDropdownRef.current &&
                !loginDropdownRef.current.contains(event.target)
            ) {
                setShowLoginDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isDarkHeaderPage = ["/", "/tourism", "/blog"].includes(location.pathname);
    const showDarkHeader = isDarkHeaderPage && !isScrolled;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setIsMobileMenuOpen(false));
        return () => window.cancelAnimationFrame(frame);
    }, [location.pathname, location.hash]);

    const getDashboardLink = () => {
        const role = user?.role?.type || user?.role || user?.userRole;
        if (role === "admin") return "/admin";
        if (role === "doctor") return "/doctor";
        if (role === "manager") return "/manager";
        if (role === "coordinator") return "/coordinator";
        return "/patient";
    };

    const isOnLanding = location.pathname === "/";

    const navLinks = [
        { href: "/", label: t("nav.home") },
        { href: "#specializations", label: t("nav.treatments"), isAnchor: true },
        { href: "/tourism", label: t("nav.tourism") },
        { href: "/blog", label: t("nav.blog") },
        { href: "#process", label: t("nav.process"), isAnchor: true },
        { href: "/prices", label: t("nav.prices") },
        { href: "#contact", label: t("nav.contacts"), isAnchor: true },
    ];

    const handleNavClick = (e, link) => {
        if (link.isAnchor) {
            e.preventDefault();
            if (isOnLanding) {
                const element = document.querySelector(link.href);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                }
            } else {
                navigate("/" + link.href);
            }
        }
    };

    return (
        <div className='min-h-screen flex flex-col'>
            {/* Mobile Menu Overlay */}
            <div
                className={cn(
                    'fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity duration-300',
                    isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Menu Panel */}
            <div
                className={cn(
                    'fixed left-0 top-0 h-(--app-height) w-72 bg-white z-60 transition-transform duration-300 lg:hidden flex flex-col',
                    isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className='p-6 border-b border-slate-100 flex items-center justify-between shrink-0'>
                    <Link to='/' onClick={() => setIsMobileMenuOpen(false)} className='flex items-center gap-3'>
                        <BrandLogo className='h-12 w-12' />
                        <div>
                            <h1 className='font-bold text-slate-900'>MedTour</h1>
                            <p className='text-xs text-slate-500'>{t("common.medical_tourism")}</p>
                        </div>
                    </Link>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className='p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                <div className='px-4 py-3 border-b border-slate-100 shrink-0'>
                    <LanguageSwitcher mode='segmented' />
                </div>

                <nav className='flex-1 p-4 space-y-1 overflow-y-auto'>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            to={link.isAnchor ? `/${link.href}` : link.href}
                            onClick={(e) => {
                                handleNavClick(e, link)
                                setIsMobileMenuOpen(false)
                            }}
                            className={cn(
                                'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                                location.pathname === link.href && !link.isAnchor
                                    ? 'bg-teal-50 text-teal-700'
                                    : 'text-slate-700 hover:bg-slate-50',
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className='p-4 border-t border-slate-100 shrink-0 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))]'>
                    {isAuthenticated ? (
                        <Link to={getDashboardLink()} onClick={() => setIsMobileMenuOpen(false)}>
                            <Button className='w-full'>{t("nav.dashboard")}</Button>
                        </Link>
                    ) : (
                        <div className='flex flex-col gap-2'>
                            <p className='text-xs text-slate-500 mb-1 px-1'>
                                {t("nav.login")}
                            </p>
                            <Link to='/login?type=patient' onClick={() => setIsMobileMenuOpen(false)}>
                                <Button
                                    variant='secondary'
                                    className='w-full justify-start'
                                    leftIcon={<UserCircle className='w-4 h-4' />}
                                >
                                    {t("nav.login_as_patient")}
                                </Button>
                            </Link>
                            <Link to='/login?type=doctor' onClick={() => setIsMobileMenuOpen(false)}>
                                <Button
                                    variant='secondary'
                                    className='w-full justify-start'
                                    leftIcon={<Stethoscope className='w-4 h-4' />}
                                >
                                    {t("nav.login_as_doctor")}
                                </Button>
                            </Link>
                            <Link to='/register' onClick={() => setIsMobileMenuOpen(false)} className='mt-2'>
                                <Button className='w-full'>{t("nav.register")}</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Header */}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
                    isScrolled || !isDarkHeaderPage
                        ? "bg-white shadow-sm"
                        : "bg-transparent",
                )}>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between h-20'>
                        {/* Logo */}
                        <Link to='/' className='flex items-center gap-3'>
                            <BrandLogo className='h-12 w-12 drop-shadow-[0_8px_18px_rgba(0,0,0,.2)]' />
                            <div>
                                <h1
                                    className={cn(
                                        "font-bold text-lg transition-colors",
                                        showDarkHeader
                                            ? "text-white"
                                            : "text-slate-900",
                                    )}>
                                    MedTour
                                </h1>
                                <p
                                    className={cn(
                                        "text-xs transition-colors",
                                        showDarkHeader
                                            ? "text-white/70"
                                            : "text-slate-500",
                                    )}>
                                    {t("common.medical_tourism")}
                                </p>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className='hidden lg:flex items-center gap-5'>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    to={link.isAnchor ? `/${link.href}` : link.href}
                                    onClick={(e) => handleNavClick(e, link)}
                                    className={cn(
                                        "relative py-2 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-[#52d1bb] after:transition-transform hover:text-[#52d1bb] hover:after:scale-x-100",
                                        showDarkHeader
                                            ? "text-white/90"
                                            : "text-slate-700",
                                        location.pathname === link.href &&
                                            !link.isAnchor &&
                                            "text-[#0a9a87] after:scale-x-100",
                                    )}>
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Right: Auth + Language */}
                        <div className='hidden lg:flex items-center gap-3'>
                            <LanguageSwitcher variant={showDarkHeader ? "dark" : "light"} />

                            {isAuthenticated ? (
                                <Link to={getDashboardLink()}>
                                    <Button>{t("nav.dashboard")}</Button>
                                </Link>
                            ) : (
                                <>
                                    <div
                                        className='relative'
                                        ref={loginDropdownRef}>
                                        <Button
                                            variant={
                                                showDarkHeader
                                                    ? "outline"
                                                    : "ghost"
                                            }
                                            className={
                                                showDarkHeader
                                                    ? "text-white border-white/30 hover:bg-white/10"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setShowLoginDropdown(
                                                    !showLoginDropdown,
                                                )
                                            }
                                            rightIcon={
                                                <ChevronDown
                                                    className={cn(
                                                        "w-4 h-4 transition-transform",
                                                        showLoginDropdown &&
                                                            "rotate-180",
                                                    )}
                                                />
                                            }>
                                            {t("nav.login")}
                                        </Button>

                                        {showLoginDropdown && (
                                            <div className='absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-slideDown'>
                                                <Link
                                                    to='/login?type=patient'
                                                    className='flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors'
                                                    onClick={() =>
                                                        setShowLoginDropdown(false)
                                                    }>
                                                    <div className='w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center'>
                                                        <UserCircle className='w-5 h-5 text-teal-600' />
                                                    </div>
                                                    <div>
                                                        <p className='font-medium text-slate-900'>
                                                            {t("auth.login.patient_tab")}
                                                        </p>
                                                        <p className='text-xs text-slate-500'>
                                                            {t("nav.patient_cabinet")}
                                                        </p>
                                                    </div>
                                                </Link>
                                                <Link
                                                    to='/login?type=doctor'
                                                    className='flex items-center gap-3 px-4 py-3 hover:bg-sky-50 transition-colors border-t border-slate-100'
                                                    onClick={() =>
                                                        setShowLoginDropdown(false)
                                                    }>
                                                    <div className='w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center'>
                                                        <Stethoscope className='w-5 h-5 text-sky-600' />
                                                    </div>
                                                    <div>
                                                        <p className='font-medium text-slate-900'>
                                                            {t("auth.login.doctor_tab")}
                                                        </p>
                                                        <p className='text-xs text-slate-500'>
                                                            {t("nav.doctor_cabinet")}
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                    <Link to='/register'>
                                        <Button>{t("nav.register")}</Button>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className={cn(
                                "lg:hidden p-2 rounded-lg transition-colors",
                                showDarkHeader
                                    ? "text-white hover:bg-white/10"
                                    : "text-slate-700 hover:bg-slate-100",
                            )}>
                            <Menu className='w-6 h-6' />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className='flex-1'>
                <Outlet />
            </main>

            {/* Footer */}
            <footer className='bg-[#081229] text-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
                    <div className='grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_.8fr_.8fr_1fr]'>
                        {/* Brand */}
                        <div>
                            <div className='flex items-center gap-3 mb-6'>
                                <BrandLogo className='h-14 w-14' />
                                <div>
                                    <h3 className='font-bold text-lg'>MedTour</h3>
                                    <p className='text-xs text-slate-400'>{t("common.medical_tourism")}</p>
                                </div>
                            </div>
                            <p className='text-slate-400 text-sm leading-relaxed'>
                                {t("footer.description")}
                            </p>
                        </div>

                        <div>
                            <h4 className='font-semibold mb-6'>{t("nav.treatments")}</h4>
                            <ul className='space-y-3'>
                                <li>
                                    <Link to='/treatments/heart-institute' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {footerTreatments[0]}
                                    </Link>
                                </li>
                                <li>
                                    <Link to='/treatments/neurosurgery' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {footerTreatments[1]}
                                    </Link>
                                </li>
                                <li>
                                    <Link to='/treatments/therapy' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {footerTreatments[2]}
                                    </Link>
                                </li>
                                <li>
                                    <a href='/#specializations' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {footerTreatments[3]}
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className='font-semibold mb-6'>{t("footer.navigation")}</h4>
                            <ul className='space-y-3'>
                                <li>
                                    <a href='/#process' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {t("nav.process")}
                                    </a>
                                </li>
                                <li>
                                    <Link to='/tourism' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {t("nav.tourism")}
                                    </Link>
                                </li>
                                <li>
                                    <Link to='/blog' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {t("nav.blog")}
                                    </Link>
                                </li>
                                <li>
                                    <Link to='/privacy' className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        {t("footer.privacy")}
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Contact */}
                        <div>
                            <h4 className='font-semibold mb-6'>{t("footer.contacts")}</h4>
                            <ul className='space-y-4'>
                                <li className='flex items-center gap-3 text-slate-400'>
                                    <Phone className='w-5 h-5 text-teal-500' />
                                    <a href='https://www.nnmc.kz/' target='_blank' rel='noreferrer' className='text-sm hover:text-white'>www.nnmc.kz</a>
                                </li>
                                <li className='flex items-center gap-3 text-slate-400'>
                                    <Mail className='w-5 h-5 text-teal-500' />
                                    <a href='mailto:support@nnmc.kz' className='text-sm hover:text-white'>support@nnmc.kz</a>
                                </li>
                                <li className='flex items-start gap-3 text-slate-400'>
                                    <MapPin className='w-5 h-5 text-teal-500 flex-shrink-0' />
                                    <span className='text-sm'>{t('footer.address')}</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className='mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4'>
                        <p className='text-slate-500 text-sm'>© {new Date().getFullYear()} MedTour.</p>
                        <div className='flex items-center gap-6'>
                            <Link to='/privacy' className='text-slate-500 hover:text-white text-sm transition-colors'>
                                {t("footer.privacy")}
                            </Link>
                            <Link to='/terms' className='text-slate-500 hover:text-white text-sm transition-colors'>
                                {t("footer.terms")}
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
            <PatientChatWidget />
        </div>
    );
}

export default PublicLayout;
