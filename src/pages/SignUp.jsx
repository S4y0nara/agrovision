import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import 'boxicons/css/boxicons.min.css'
import { useLanguage } from '../context/LanguageContext'

const SignUp = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from || '/'
    const { login } = useAuth()
    const { t, lang } = useLanguage()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [socialLoading, setSocialLoading] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [verificationPending, setVerificationPending] = useState(false)
    const [verificationEmail, setVerificationEmail] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [devCode, setDevCode] = useState('')
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
    const [focused, setFocused] = useState({ name: false, email: false, password: false, confirmPassword: false })

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
    const handleFocus = (field) => setFocused({ ...focused, [field]: true })
    const handleBlur = (field) => { if (!formData[field]) setFocused({ ...focused, [field]: false }) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (formData.password !== formData.confirmPassword) {
            setError(t('auth_pwd_error'))
            return
        }

        setLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const response = await fetch('http://localhost:5001/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: formData.name, email: formData.email, password: formData.password }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()

            if (response.ok) {
                if (data.requiresVerification) {
                    setVerificationPending(true)
                    setVerificationEmail(data.email || formData.email)
                    setSuccessMessage(data.message || 'Please check your email to verify your account.')
                    setDevCode(data.devCode || '')
                    return
                }

                if (data.token && data.user) {
                    login(data.user, data.token)
                    navigate(data.user.role === 'admin' ? '/admin' : from, { replace: true })
                    return
                }
            }

            setError(data.message || 'Registration failed')
        } catch {
            setError('Server unavailable. Please start the backend so we can send the verification email.')
        } finally {
            setLoading(false)
        }
    }

    const handleResendVerification = async () => {
        const email = verificationEmail || formData.email
        if (!email) return

        setLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const response = await fetch('http://localhost:5001/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()

            if (response.ok) {
                setSuccessMessage(data.message || 'Verification email sent.')
                setDevCode(data.devCode || '')
            } else {
                setError(data.message || 'Could not resend verification email.')
            }
        } catch {
            setError('Server unavailable. Please try again once the backend is running.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyCode = async (e) => {
        e.preventDefault()
        const code = verificationCode.trim()
        if (!/^\d{6}$/.test(code)) {
            setError('Please enter the 6-digit code sent to your email.')
            return
        }

        setLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const response = await fetch('http://localhost:5001/api/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verificationEmail || formData.email, code }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()

            if (response.ok && data.token && data.user) {
                login(data.user, data.token)
                navigate(data.user.role === 'admin' ? '/admin' : from, { replace: true })
                return
            }

            setError(data.message || 'Invalid or expired verification code.')
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
        <div className={`min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden py-10 ${isRTL ? 'rtl' : 'ltr'}`}>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-100/50 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[120px]"></div>

            <div className={`relative z-10 w-full max-w-[1100px] flex flex-col md:flex-row bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[750px] mx-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#006837] to-[#1DB954] p-12 flex-col justify-between relative overflow-hidden">
                    <div className={`relative z-10 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-2 mb-12 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <i className='bx bxs-leaf text-4xl text-white'></i>
                            <span className="text-white text-2xl font-bold tracking-tight">AgroVision</span>
                        </div>
                        <h2 className="text-5xl font-bold text-white leading-tight mb-6">{t('auth_signup_title')}</h2>
                        <p className="text-white/80 text-lg leading-relaxed">{t('auth_signup_subtitle')}</p>
                    </div>
                    <div className={`relative z-10 flex items-center gap-4 text-white/60 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span>2026 AgroVision Inc.</span>
                        <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                        <span>Terms of Service</span>
                    </div>
                    <div className="absolute top-[-10%] right-[-20%] w-[70%] h-[70%] border-[40px] border-white/5 rounded-full"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className={`mb-7 ${isRTL ? 'text-right' : ''}`}>
                            <h1 className="text-3xl font-bold text-[#1e293b] mb-2">{verificationPending ? (lang === 'FR' ? 'Vérifiez votre email' : 'Verify your email') : t('auth_signup_title')}</h1>
                            <p className="text-slate-500 text-sm">{verificationPending ? (lang === 'FR' ? 'Entrez le code à 6 chiffres envoyé à votre email.' : 'Enter the 6-digit code sent to your email.') : t('auth_signup_subtitle')}</p>
                            {error && <div className="mt-3 p-3 bg-red-50 text-red-500 text-sm font-medium rounded-xl border border-red-100">{error}</div>}
                            {successMessage && <div className="mt-3 p-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl border border-emerald-100">{successMessage}</div>}
                        </div>

                        {verificationPending ? (
                            <div className="space-y-5">
                                <form onSubmit={handleVerifyCode} className="space-y-5">
                                <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <div className="w-12 h-12 rounded-2xl bg-[#1DB954] text-white flex items-center justify-center mb-4">
                                        <i className="bx bx-envelope text-2xl"></i>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {lang === 'FR' ? 'Nous avons envoyé un code de vérification à :' : 'We sent a verification code to:'}
                                    </p>
                                    <p className="text-sm font-bold text-[#1DB954] mt-2 break-all">{verificationEmail}</p>
                                    {devCode && <p className="text-xs text-slate-500 mt-4">Local dev code: <strong>{devCode}</strong></p>}
                                </div>

                                <div>
                                    <label className={`block text-sm font-semibold text-slate-700 mb-1 ${isRTL ? 'text-right' : ''}`}>
                                        {lang === 'FR' ? 'Code de vérification' : 'Verification code'}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full tracking-[0.45em] text-center py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] text-2xl font-black text-slate-800"
                                        placeholder="000000"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 bg-[#1e293b] text-white text-center font-bold rounded-2xl hover:bg-[#334155] transition-all disabled:opacity-60"
                                >
                                    {loading ? 'Checking...' : (lang === 'FR' ? 'Vérifier et continuer' : 'Verify and continue')}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    disabled={loading}
                                    className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all disabled:opacity-60"
                                >
                                    {loading ? 'Sending...' : 'Resend verification email'}
                                </button>

                                <Link to="/signin" className="block w-full py-3.5 bg-[#1e293b] text-white text-center font-bold rounded-2xl hover:bg-[#334155] transition-all">
                                    Go to sign in
                                </Link>
                                </form>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-3 mb-6">
                                    <button
                                        type="button"
                                        id="signup-google-btn"
                                        onClick={() => handleSocialLogin('google')}
                                        disabled={!!socialLoading}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                                    >
                                        {socialLoading === 'google' ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <i className='bx bxl-google text-xl'></i>}
                                        Google
                                    </button>
                                    <button
                                        type="button"
                                        id="signup-facebook-btn"
                                        onClick={() => handleSocialLogin('facebook')}
                                        disabled={!!socialLoading}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl font-semibold text-sm hover:bg-[#166fe5] transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                                    >
                                        {socialLoading === 'facebook' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className='bx bxl-facebook text-xl'></i>}
                                        Facebook
                                    </button>
                                </div>

                                <div className="relative flex items-center gap-3 mb-5">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className={`block text-sm font-semibold text-slate-700 mb-1 ${isRTL ? 'text-right' : ''}`}>{t('auth_name')}</label>
                                        <div className="relative">
                                            <i className={`bx bx-user absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.name ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                            <input type="text" name="name" id="signup-name" value={formData.name} onChange={handleChange} onFocus={() => handleFocus('name')} onBlur={() => handleBlur('name')} required autoComplete="name"
                                                className={`w-full ${isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'} py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                                placeholder={t('auth_name_placeholder')} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-semibold text-slate-700 mb-1 ${isRTL ? 'text-right' : ''}`}>{t('auth_email')}</label>
                                        <div className="relative">
                                            <i className={`bx bx-envelope absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.email ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                            <input type="email" name="email" id="signup-email" value={formData.email} onChange={handleChange} onFocus={() => handleFocus('email')} onBlur={() => handleBlur('email')} required autoComplete="email"
                                                className={`w-full ${isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4'} py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                                placeholder={t('auth_email_placeholder')} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-semibold text-slate-700 mb-1 ${isRTL ? 'text-right' : ''}`}>{t('auth_pwd')}</label>
                                        <div className="relative">
                                            <i className={`bx bx-lock-alt absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.password ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                            <input type={showPassword ? 'text' : 'password'} name="password" id="signup-password" value={formData.password} onChange={handleChange} onFocus={() => handleFocus('password')} onBlur={() => handleBlur('password')} required autoComplete="new-password"
                                                className={`w-full ${isRTL ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                                placeholder={t('auth_pwd_placeholder')} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}>
                                                <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-semibold text-slate-700 mb-1 ${isRTL ? 'text-right' : ''}`}>{t('auth_confirm_pwd')}</label>
                                        <div className="relative">
                                            <i className={`bx bx-check-double absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-xl transition-colors ${focused.confirmPassword ? 'text-[#1DB954]' : 'text-slate-400'}`}></i>
                                            <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" id="signup-confirm-password" value={formData.confirmPassword} onChange={handleChange} onFocus={() => handleFocus('confirmPassword')} onBlur={() => handleBlur('confirmPassword')} required autoComplete="new-password"
                                                className={`w-full ${isRTL ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954] transition-all text-slate-700`}
                                                placeholder={t('auth_pwd_placeholder')} />
                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}>
                                                <i className={`bx ${showConfirmPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div className={`flex items-start gap-2 pt-1 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                        <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#1DB954] focus:ring-[#1DB954]" />
                                        <span className="text-xs text-slate-500 leading-relaxed">{t('auth_terms')}</span>
                                    </div>

                                    <button type="submit" id="signup-submit-btn" disabled={loading}
                                        className="w-full py-3.5 bg-[#1e293b] text-white font-bold rounded-2xl hover:bg-[#334155] transition-all shadow-xl shadow-slate-200 disabled:opacity-60 mt-2">
                                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : t('auth_signup_btn')}
                                    </button>
                                </form>

                                <div className="mt-5 text-center">
                                    <p className="text-slate-500 text-sm">
                                        {t('auth_already_acc')}{' '}
                                        <Link to="/signin" className="text-[#1DB954] font-bold hover:underline">{t('auth_login_btn')}</Link>
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Link to="/" className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-400 hover:text-[#1DB954] transition-colors flex items-center gap-2 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
                <i className="bx bx-arrow-back"></i>
                {t('auth_return_home')}
            </Link>
        </div>
    )
}

export default SignUp
