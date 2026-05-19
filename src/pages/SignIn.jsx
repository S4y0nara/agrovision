import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import 'boxicons/css/boxicons.min.css'
import { useLanguage } from '../context/LanguageContext'

const oauthErrorMessages = {
    google_not_configured: 'Google sign in is not configured yet. Add Google OAuth credentials to the backend .env file.',
    facebook_not_configured: 'Facebook sign in is not configured yet. Add Facebook OAuth credentials to the backend .env file.',
    google_oauth_failed: 'Google sign in failed. Please check the OAuth callback URL and credentials.',
    facebook_oauth_failed: 'Facebook sign in failed. Please check the OAuth callback URL and credentials.',
    banned: 'Your account has been suspended by the administrator.',
    verification_invalid: 'Verification link is invalid or expired.',
    verification_failed: 'Email verification failed. Please request a new link.'
}

const SignIn = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from || '/'
    const { t, lang } = useLanguage()
    const { login } = useAuth()
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [focused, setFocused] = useState({ email: false, password: false })
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [unverifiedEmail, setUnverifiedEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [socialLoading, setSocialLoading] = useState(null)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        const query = new URLSearchParams(location.search)
        const verified = query.get('verified')
        const reset = query.get('reset')
        const errorCode = query.get('error')

        if (verified) {
            setSuccessMessage('Email verified successfully. You can sign in now.')
        }

        if (reset) {
            setSuccessMessage('Password updated successfully. You can sign in now.')
        }

        if (errorCode) {
            setError(oauthErrorMessages[errorCode] || 'Authentication failed. Please try again.')
        }
    }, [location.search])

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
    const handleFocus = (field) => setFocused({ ...focused, [field]: true })
    const handleBlur = (field) => { if (!formData[field]) setFocused({ ...focused, [field]: false }) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccessMessage('')
        setUnverifiedEmail('')

        try {
            const response = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, password: formData.password }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()
            if (response.ok) {
                login(data.user, data.token)
                navigate(data.user.role === 'admin' ? '/admin' : from, { replace: true })
                return
            }

            if (data.code === 'EMAIL_NOT_VERIFIED') {
                setUnverifiedEmail(formData.email)
            }

            setError(data.message || 'Invalid email or password.')
        } catch {
            const demoAccounts = [
                { email: 'admin', password: 'admin', user: { id: 'demo-admin', fullName: 'Administrator', email: 'admin', role: 'admin' } },
                { email: 'admin@agrovision.com', password: 'admin', user: { id: 'demo-admin', fullName: 'Administrator', email: 'admin@agrovision.com', role: 'admin' } },
                { email: 'youssef@admin.com', password: 'admin', user: { id: 'demo-youssef', fullName: 'youssefAdmin', email: 'youssef@admin.com', role: 'admin' } },
            ]
            const demo = demoAccounts.find((a) => a.email === formData.email && a.password === formData.password)
            if (demo) {
                login(demo.user, 'demo-token-' + Date.now())
                navigate('/admin', { replace: true })
                return
            }
            setError('Server unavailable. Please start the backend, or use an admin demo account.')
        } finally {
            setLoading(false)
        }
    }

    const handleResendVerification = async () => {
        if (!unverifiedEmail) return

        setLoading(true)
        setError('')
        try {
            const response = await fetch('http://localhost:5001/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: unverifiedEmail }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()
            if (response.ok) {
                setSuccessMessage(data.message || 'Verification email sent.')
            } else {
                setError(data.message || 'Could not resend verification email.')
            }
        } catch {
            setError('Server unavailable. Please try again once the backend is running.')
        } finally {
            setLoading(false)
        }
    }

    const handleSocialLogin = async (provider) => {
        setSocialLoading(provider)
        window.location.href = `http://localhost:5001/api/auth/${provider}`
    }

    const isRTL = lang === 'AR'

    return (
        <div className={`min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}>
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-100/50 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[120px]"></div>

            <div className={`relative z-10 w-full max-w-[1100px] flex flex-col md:flex-row bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[680px] mx-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#006837] to-[#1DB954] p-12 flex-col justify-between relative overflow-hidden">
                    <div className={`relative z-10 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className={`flex items-center gap-2 mb-12 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <i className='bx bxs-leaf text-4xl text-white'></i>
                            <span className="text-white text-2xl font-bold tracking-tight">AgroVision</span>
                        </div>
                        <h2 className="text-5xl font-bold text-white leading-tight mb-6">{t('auth_back_title')}</h2>
                        <p className="text-white/80 text-lg leading-relaxed">{t('auth_back_desc')}</p>
                    </div>
                    <div className={`relative z-10 flex items-center gap-4 text-white/60 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span>2026 AgroVision Inc.</span>
                        <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                        <span>Privacy Policy</span>
                    </div>
                    <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] border-[40px] border-white/5 rounded-full"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className={`mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <h1 className="text-3xl font-bold text-[#1e293b] mb-2">{t('auth_welcome')}</h1>
                            <p className="text-slate-500 text-sm">{t('auth_subtitle')}</p>
                            {error && (
                                <div className="mt-4 p-3 bg-red-50 text-red-500 text-sm font-medium rounded-xl border border-red-100">
                                    {error}
                                    {unverifiedEmail && (
                                        <button onClick={handleResendVerification} type="button" className="block mt-2 text-[#1DB954] font-bold hover:underline">
                                            Resend verification email
                                        </button>
                                    )}
                                </div>
                            )}
                            {successMessage && <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl border border-emerald-100">{successMessage}</div>}
                        </div>

                        <div className="flex gap-3 mb-6">
                            <button
                                type="button"
                                id="signin-google-btn"
                                onClick={() => handleSocialLogin('google')}
                                disabled={!!socialLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                            >
                                {socialLoading === 'google' ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <i className='bx bxl-google text-xl'></i>}
                                Google
                            </button>
                            <button
                                type="button"
                                id="signin-facebook-btn"
                                onClick={() => handleSocialLogin('facebook')}
                                disabled={!!socialLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white border border-[#1877F2] rounded-xl font-semibold text-sm hover:bg-[#166fe5] transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                            >
                                {socialLoading === 'facebook' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className='bx bxl-facebook text-xl'></i>}
                                Facebook
                            </button>
                        </div>

                        <div className="relative flex items-center gap-3 mb-6">
                            <div className="flex-1 h-px bg-slate-200"></div>
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
                            <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className={`block text-sm font-semibold text-slate-700 ${isRTL ? 'text-right' : ''}`}>{t('auth_email')}</label>
                                <div className="relative">
                                    <i className={`bx bx-user absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.email ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                    <input
                                        type="email"
                                        name="email"
                                        id="signin-email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onFocus={() => handleFocus('email')}
                                        onBlur={() => handleBlur('email')}
                                        required
                                        autoComplete="username"
                                        className={`w-full ${isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                        placeholder={t('auth_email_placeholder')}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`block text-sm font-semibold text-slate-700 ${isRTL ? 'text-right' : ''}`}>{t('auth_pwd')}</label>
                                <div className="relative">
                                    <i className={`bx bx-lock-alt absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.password ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        id="signin-password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        onFocus={() => handleFocus('password')}
                                        onBlur={() => handleBlur('password')}
                                        required
                                        autoComplete="current-password"
                                        className={`w-full ${isRTL ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                        placeholder={t('auth_pwd_placeholder')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}
                                    >
                                        <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#1DB954] focus:ring-[#1DB954]" />
                                    <span className="text-sm text-slate-600">{t('auth_remember')}</span>
                                </label>
                                <Link to="/forgot-password" className="text-sm font-semibold text-[#1DB954] hover:text-[#17a34a]">{t('auth_forgot')}</Link>
                            </div>

                            <button
                                type="submit"
                                id="signin-submit-btn"
                                disabled={loading}
                                className="w-full py-3.5 bg-[#1e293b] text-white font-bold rounded-2xl hover:bg-[#334155] transition-all shadow-xl shadow-slate-200 disabled:opacity-60"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : t('auth_login_btn')}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-slate-500 text-sm">
                                {t('auth_new_here')}{' '}
                                <Link to="/signup" className="text-[#1DB954] font-bold hover:underline">{t('auth_create_acc')}</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Link to="/" className={`absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400 hover:text-[#1DB954] transition-colors flex items-center gap-2 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
                <i className="bx bx-arrow-back"></i>
                {t('auth_return_home')}
            </Link>
        </div>
    )
}

export default SignIn
