import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const ResetPassword = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const token = new URLSearchParams(location.search).get('token') || ''
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setMessage('')
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('http://localhost:5001/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Could not update password.')
            }

            setMessage(data.message || 'Password updated.')
            setTimeout(() => navigate('/signin?reset=1', { replace: true }), 900)
        } catch (err) {
            setError(err.message || 'Server unavailable. Please try again later.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
                <Link to="/signin" className="text-sm font-bold text-[#1DB954] hover:underline">Back to sign in</Link>
                <h1 className="text-3xl font-black text-slate-900 mt-5 mb-2">Create new password</h1>
                <p className="text-slate-500 text-sm mb-6">Choose a new password for your AgroVision account.</p>

                {message && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-sm">{message}</div>}
                {error && <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 text-sm">{error}</div>}

                {!token ? (
                    <div className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 text-sm">Reset token is missing.</div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">New password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Confirm password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954]"
                            />
                        </div>
                        <button disabled={loading} className="w-full py-3.5 bg-[#1e293b] text-white font-bold rounded-2xl hover:bg-[#334155] transition-all disabled:opacity-60">
                            {loading ? 'Updating...' : 'Update password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default ResetPassword
