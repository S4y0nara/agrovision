import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                if (data.user.role !== 'admin') {
                    setError('Accès refusé: Vous n\'avez pas les droits d\'administration.');
                    setLoading(false);
                    return;
                }
                login(data.user, data.token);
                navigate('/admin');
            } else {
                setError(data.message || 'Identifiants incorrects');
            }
        } catch {
            setError('Erreur de connexion au serveur');
        }
        
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements to match AgroVision aesthetic but darker for admin */}
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 z-0"></div>
            <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-emerald-900/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 z-0"></div>

            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-2xl z-10 relative">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-white border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] overflow-hidden">
                        <img src="/agrovision.png" alt="AgroVision" className="w-14 h-14 object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-white text-center">Espace Admin</h1>
                    <p className="text-slate-400 mt-2 text-center text-sm font-medium">Connectez-vous pour gérer AgroVision</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-6 text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
                        <i className='bx bx-error-circle text-lg'></i>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 ml-1">Email Administrateur</label>
                        <div className="relative">
                            <i className='bx bx-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg'></i>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="admin@agrovision.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 ml-1">Mot de passe</label>
                        <div className="relative">
                            <i className='bx bx-lock-alt absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg'></i>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 transition-all mt-8 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]"
                    >
                        {loading ? (
                            <i className='bx bx-loader-alt animate-spin text-xl'></i>
                        ) : (
                            <>
                                <span>Connexion Sécurisée</span>
                                <i className='bx bx-right-arrow-alt text-xl'></i>
                            </>
                        )}
                    </button>
                    
                    <div className="text-center mt-6">
                        <button 
                            type="button" 
                            onClick={() => navigate('/auth')}
                            className="text-slate-500 hover:text-white text-sm font-medium transition-colors"
                        >
                            Retour à l'accueil
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
