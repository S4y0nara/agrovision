import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const decodeJwtUser = (token) => {
    const base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => (
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    )).join(''));

    const decoded = JSON.parse(jsonPayload);
    return {
        id: decoded.id,
        fullName: decoded.fullName || 'AgroVision User',
        email: decoded.email || '',
        role: decoded.role || 'user',
        profilePic: decoded.profilePic || '',
        isEmailVerified: true
    };
};

const AuthSuccess = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [status, setStatus] = useState('Completing sign in...');
    const hasCompleted = useRef(false);

    useEffect(() => {
        if (hasCompleted.current) return;
        hasCompleted.current = true;

        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        const userParam = queryParams.get('user');

        if (!token) {
            setStatus('No authentication token found.');
            setTimeout(() => navigate('/signin', { replace: true }), 1000);
            return;
        }

        try {
            const userData = userParam ? JSON.parse(userParam) : decodeJwtUser(token);
            login(userData, token);
            setStatus('Success! Redirecting...');
            setTimeout(() => {
                navigate(userData.role === 'admin' ? '/admin' : '/', { replace: true });
            }, 350);
        } catch (err) {
            console.error('OAuth completion error', err);
            setStatus('Failed to complete authentication.');
            setTimeout(() => navigate('/signin', { replace: true }), 1000);
        }
    }, [login, navigate]);

    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl flex flex-col items-center shadow-2xl">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h2 className="text-white font-bold text-lg">{status}</h2>
            </div>
        </div>
    );
};

export default AuthSuccess;
