import { useState } from 'react'
import { Link } from 'react-router-dom'

const ForgotPassword = () => {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        setError('')

        try {
            const response = await fetch('http://localhost:5001/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                signal: AbortSignal.timeout(5000)
            })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Could not send reset email.')
            }

            setMessage(data.message || 'If this email has an account, a password reset link has been sent.')
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
                <h1 className="text-3xl font-black text-slate-900 mt-5 mb-2">Reset password</h1>
                <p className="text-slate-500 text-sm mb-6">Enter your email and we will send a secure link to create a new password.</p>

                {message && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-sm">{message}</div>}
                {error && <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-[#1DB954]"
                            placeholder="your@email.com"
                        />
                    </div>
                    <button disabled={loading} className="w-full py-3.5 bg-[#1e293b] text-white font-bold rounded-2xl hover:bg-[#334155] transition-all disabled:opacity-60">
                        {loading ? 'Sending...' : 'Send reset link'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default ForgotPassword
