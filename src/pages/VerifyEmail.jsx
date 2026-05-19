import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const VerifyEmail = () => {
    const location = useLocation()
    const [status, setStatus] = useState('Verifying your email...')
    const [state, setState] = useState('loading')

    useEffect(() => {
        const token = new URLSearchParams(location.search).get('token')

        if (!token) {
            setStatus('Verification token is missing.')
            setState('error')
            return
        }

        const verify = async () => {
            try {
                const response = await fetch('http://localhost:5001/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                })
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.message || 'Verification failed.')
                }

                setStatus(data.message || 'Email verified successfully. You can now sign in.')
                setState('success')
            } catch (err) {
                setStatus(err.message || 'Verification failed. Please request a new link.')
                setState('error')
            }
        }

        verify()
    }, [location.search])

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white ${state === 'error' ? 'bg-red-500' : 'bg-[#1DB954]'}`}>
                    {state === 'loading' ? (
                        <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <i className={`bx ${state === 'error' ? 'bx-x' : 'bx-check'} text-4xl`}></i>
                    )}
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-3">Email verification</h1>
                <p className="text-slate-500 leading-relaxed mb-6">{status}</p>
                <Link to="/signin" className="inline-flex justify-center w-full py-3.5 rounded-2xl bg-[#1e293b] text-white font-bold hover:bg-[#334155] transition-all">
                    Go to sign in
                </Link>
            </div>
        </div>
    )
}

export default VerifyEmail
