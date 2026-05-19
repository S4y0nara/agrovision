import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const AuthGateway = () => {
    const { t, lang } = useLanguage();
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [socialLoading, setSocialLoading] = useState(null);

    const handleSocialLogin = (provider) => {
        if (provider === 'google') {
            setSocialLoading(provider);
            window.location.href = 'http://localhost:5001/api/auth/google';
        } else if (provider === 'facebook') {
            setSocialLoading(provider);
            window.location.href = 'http://localhost:5001/api/auth/facebook';
        } else {
            console.log(provider + ' login not strictly implemented yet.');
        }
    };

    return (
        <div className={`min-h-screen w-full bg-gradient-to-br from-green-50 to-white relative overflow-hidden flex flex-col items-center justify-center py-20 ${lang === 'AR' ? 'rtl' : 'ltr'}`}>

            {/* Back to Home Arrow */}
            <Link
                to="/"
                className="absolute top-8 left-8 p-3 rounded-full hover:bg-white/50 transition-all duration-300 z-50 group"
                title={t('auth_return_home')}
            >
                <i className='bx bx-left-arrow-alt text-4xl text-slate-700 group-hover:text-green-600 transition-colors transform group-hover:-translate-x-1'></i>
            </Link>

            {/* Background Decorative Glows */}
            <div className="absolute -bottom-[10%] -left-[10%] w-[60%] h-[60%] bg-green-100 rounded-full blur-[120px] pointer-events-none opacity-50 animate-pulse-slow"></div>
            <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[100px] pointer-events-none opacity-60"></div>

            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="waves" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                            <path d="M0 60 Q 30 30 60 60 T 120 60" fill="none" stroke="#22c55e" strokeWidth="1" />
                            <path d="M0 80 Q 30 50 60 80 T 120 80" fill="none" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#waves)" />
                </svg>
            </div>

            {/* Logo Area */}
            <div className="mb-8 flex flex-col items-center animate-fade-in-down relative z-10 w-full px-4">
                <div className="w-32 h-32 mb-6 bg-white p-6 rounded-[2rem] shadow-xl shadow-green-100 transform hover:scale-105 transition-transform duration-500">
                    <img src="/agrovision.png" alt="AgroVision Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-extrabold text-slate-800 tracking-[0.4em] uppercase opacity-70">AgroVision</span>
            </div>

            {/* Typography Heading */}
            <div className="text-center mb-12 animate-fade-in relative z-10 px-2 w-full max-w-full">
                <h1 className="text-3xl md:text-5xl font-sans font-bold text-slate-900 tracking-tight leading-[1.2] mb-2 drop-shadow-sm">
                    "{t('gateway_h1')}"
                </h1>
                <h2 className="text-xl md:text-3xl font-sans font-medium text-slate-500 tracking-tight leading-[1.2]">
                    {t('gateway_h2')}
                </h2>
            </div>

            {/* Buttons Container */}
            <div className="w-full max-w-[450px] space-y-4 animate-fade-in-up px-6 relative z-10">
                {/* Sign Up - Solid Green */}
                <button
                    onClick={() => navigate('/signup', { state: location.state })}
                    className="w-full py-5 bg-[#1DB954] hover:bg-[#1aa34a] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 text-sm tracking-widest uppercase flex items-center justify-center gap-2 group"
                >
                    {t('gateway_signup')}
                </button>

                {/* Sign In - Outlined */}
                <button
                    onClick={() => navigate('/signin', { state: location.state })}
                    className="w-full py-5 bg-white border-2 border-slate-100 text-slate-800 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md text-sm tracking-widest uppercase"
                >
                    {t('gateway_signin')}
                </button>

                <div className="flex gap-4 pt-2">
                    {/* Continue with Google */}
                    <button
                        id="gateway-google-btn"
                        onClick={() => handleSocialLogin('google')}
                        disabled={!!socialLoading}
                        className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all duration-300 shadow-sm flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60"
                    >
                        {socialLoading === 'google' ? (
                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        )}
                        Google
                    </button>

                    {/* Continue with Facebook */}
                    <button
                        id="gateway-facebook-btn"
                        onClick={() => handleSocialLogin('facebook')}
                        disabled={!!socialLoading}
                        className="flex-1 py-4 bg-[#1877F2] text-white font-bold rounded-2xl hover:bg-[#166fe5] transition-all duration-300 shadow-sm flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60"
                    >
                        {socialLoading === 'facebook' ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                        )}
                        Facebook
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 text-slate-400/60 text-[10px] font-medium uppercase tracking-widest">
                © 2026 AgroVision.
            </div>
        </div>
    );
};

export default AuthGateway;
