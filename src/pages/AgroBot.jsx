import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spline from '@splinetool/react-spline';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';

const AgroBot = () => {
    const { t, lang } = useLanguage();
    const { user, token } = useAuth();
    const { id: urlChatId } = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef(null);

    const API_URL = 'http://localhost:5001/api/chat';

    const getWelcomeMessage = useCallback(() => ({
        role: 'assistant',
        content: t('bot_initial_msg') || "Bienvenue dans votre espace AgroBot ! 🌱"
    }), [t]);

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [deleteMode, setDeleteMode] = useState('single');
    const [isInitialLoading, setIsInitialLoading] = useState(false);

    const suggestions = [
        t('bot_suggestion_1') || "Mildiou ?",
        t('bot_suggestion_2') || "Semis blé ?",
        t('bot_suggestion_3') || "Irrigation ?",
        t('bot_suggestion_4') || "Feuilles jaunes ?"
    ];

    // ─── Fetch history helper (defined first so it can be reused) ───────────────
    const fetchHistory = useCallback(async () => {
        try {
            if (!token) return;
            const res = await fetch(`${API_URL}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (err) {
            console.error("History fetch error:", err);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            navigate('/signin');
        } else {
            fetchHistory();
        }
    }, [user, navigate, fetchHistory]);

    useEffect(() => {
        if (urlChatId) {
            if (urlChatId !== currentChatId) {
                loadConversation(urlChatId);
            }
        } else {
            setMessages([getWelcomeMessage()]);
            setCurrentChatId(null);
        }
    }, [urlChatId]); // eslint-disable-line

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const loadConversation = async (id) => {
        if (!id) return;
        setIsInitialLoading(true);
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const visibleMessages = (data.messages || [])
                    .filter(m => m.role !== 'system')
                    .map(m => ({
                        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
                        content: m.content
                    }));

                setMessages(visibleMessages.length > 0 ? visibleMessages : [getWelcomeMessage()]);
                setCurrentChatId(id);
            } else {
                navigate('/AgroBot');
            }
        } catch (err) {
            console.error("Load error:", err);
            navigate('/AgroBot');
        } finally {
            setIsInitialLoading(false);
            setShowSidebar(false);
        }
    };

    const startNewChat = () => {
        setMessages([getWelcomeMessage()]);
        setCurrentChatId(null);
        setShowSidebar(false);
        navigate('/AgroBot');
    };

    const handleSendMessage = async (text) => {
        const msgText = (text || input).trim();
        if (!msgText) return;

        const userMsg = { role: 'user', content: msgText };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: msgText,
                    conversationId: currentChatId || undefined,
                    language: lang?.toLowerCase() || 'fr'
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

                if (!currentChatId && data.conversationId && data.conversationId !== 'offline-session') {
                    setCurrentChatId(data.conversationId);
                    navigate(`/AgroBot/${data.conversationId}`, { replace: true });
                }
                // Refresh history after new message
                fetchHistory();
            } else {
                const errData = await res.json().catch(() => ({}));
                setMessages(prev => [...prev, { role: 'assistant', content: errData.message || "⚠️ Erreur serveur. Vérifiez votre connexion." }]);
            }
        } catch (err) {
            console.error("Send error:", err);
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Impossible de contacter le serveur. Vérifiez que le backend est démarré." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const confirmDelete = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setChatToDelete(id);
        setDeleteMode('single');
        setShowDeleteModal(true);
    };

    const confirmClearHistory = () => {
        setChatToDelete(null);
        setDeleteMode('all');
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (deleteMode === 'all') {
            setShowDeleteModal(false);
            setConversations([]);
            startNewChat();

            try {
                const res = await fetch(`${API_URL}/history/all`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Clear history failed on server");
            } catch (err) {
                console.error("Clear history error:", err);
                fetchHistory();
            }
            return;
        }

        if (!chatToDelete) return;
        const id = chatToDelete;

        setShowDeleteModal(false);
        setChatToDelete(null);

        // Optimistically remove from sidebar
        setConversations(prev => prev.filter(c => c._id !== id));
        if (currentChatId === id) startNewChat();

        try {
            const res = await fetch(`${API_URL}/${id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Delete failed on server");
        } catch (err) {
            console.error("Delete error:", err);
            fetchHistory(); // restore list if delete failed
        }
    };

    const isRTL = lang === 'AR';

    return (
        /* mt-[80px] = exactly below navbar. h-[calc(100vh-80px)] = remaining full height */
        <div className={`flex mt-[80px] h-[calc(100vh-80px)] bg-white overflow-hidden font-sans selection:bg-[#1DB954]/20 ${isRTL ? 'rtl' : 'ltr'}`}>

            {/* ── SIDEBAR ── */}
            <div className={`
                fixed top-[80px] bottom-0 z-40 w-80
                bg-slate-50/90 backdrop-blur-xl
                border-${isRTL ? 'l' : 'r'} border-slate-200
                transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                md:translate-x-0 md:static md:flex md:flex-col
                ${isRTL ? 'right-0' : 'left-0'}
                ${showSidebar ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
                flex flex-col
            `}>

                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="p-2 bg-[#1DB954] rounded-xl shadow-[0_5px_15px_rgba(29,185,84,0.3)]">
                            <i className='bx bx-history text-white text-xl'></i>
                        </div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">Historique</h2>
                    </div>
                </div>

                {/* New Chat Button */}
                <div className="p-4 border-b border-slate-100">
                    <button
                        onClick={startNewChat}
                        className="w-full bg-slate-900 text-white p-3.5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#1DB954] transition-all duration-300 shadow-xl group active:scale-95"
                    >
                        <i className='bx bx-plus-circle text-xl group-hover:rotate-90 transition-transform duration-300'></i>
                        <span className="text-[10px] tracking-widest uppercase">Nouveau Chat</span>
                    </button>
                    {conversations.length > 0 && (
                        <button
                            onClick={confirmClearHistory}
                            className="w-full mt-3 bg-red-50 text-red-500 p-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all duration-300 active:scale-95"
                        >
                            <i className='bx bx-trash text-lg'></i>
                            <span className="text-[10px] tracking-widest uppercase">Effacer l'historique</span>
                        </button>
                    )}
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-chat-scrollbar">
                    {conversations.length === 0 && (
                        <p className="text-xs text-slate-400 text-center mt-8 italic">Aucune conversation pour l'instant</p>
                    )}
                    {conversations.map(chat => (
                        <div
                            key={chat._id}
                            onClick={() => loadConversation(chat._id)}
                            className={`group relative p-4 rounded-2xl cursor-pointer border transition-all duration-300 ${currentChatId === chat._id
                                ? 'bg-white border-[#1DB954] text-[#1DB954] shadow-lg shadow-green-500/10'
                                : 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:shadow-md hover:border-slate-200'}`}
                        >
                            <p className={`text-sm font-bold truncate ${isRTL ? 'pl-10 text-right' : 'pr-10 text-left'}`}>
                                {chat.title || "Consultation"}
                            </p>
                            <div className={`flex items-center gap-2 mt-1 opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <i className='bx bx-time text-xs'></i>
                                <span className="text-[10px] font-bold">
                                    {new Date(chat.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                            {/* Delete button - always visible on hover */}
                            <button
                                onClick={(e) => confirmDelete(e, chat._id)}
                                title="Supprimer"
                                className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all`}
                            >
                                <i className='bx bx-trash-alt text-lg'></i>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile overlay */}
            {showSidebar && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setShowSidebar(false)}></div>
            )}

            {/* ── MAIN CHAT AREA ── */}
            <div className="flex-1 flex flex-col relative bg-slate-50/30 overflow-hidden min-w-0">

                {/* 3D Spline Background — scale 120% and positioned slightly lower */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[5%] left-0 right-0 bottom-0 opacity-40 transform scale-[1.2] origin-center">
                        <Spline scene="https://prod.spline.design/hVGVRMoBFjvVfPV3/scene.splinecode" />
                    </div>
                </div>

                {/* Chat Header */}
                <div className="flex-none p-4 md:px-10 border-b border-slate-100 flex items-center justify-between bg-white/70 backdrop-blur-xl z-20 shadow-sm">
                    <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button
                            onClick={() => setShowSidebar(s => !s)}
                            className="md:hidden text-3xl text-slate-800 hover:text-[#1DB954] transition-colors"
                        >
                            <i className='bx bx-menu-alt-left'></i>
                        </button>
                        <div className="w-11 h-11 bg-[#1DB954] rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-green-500/20">
                            <i className='bx bx-bot'></i>
                        </div>
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                            <h1 className="font-black text-slate-900 tracking-tighter uppercase text-lg">
                                AgroBot <span className="text-[#1DB954]">Expert</span>
                            </h1>
                            <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {t('bot_specialist') || 'Spécialiste Agronome'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 z-10 custom-chat-scrollbar relative scroll-smooth">

                    {isInitialLoading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-xl z-30 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-slate-100 rounded-full relative">
                                <div className="absolute inset-0 border-4 border-[#1DB954] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="mt-4 font-black text-slate-800 tracking-widest uppercase text-xs">Synchronisation...</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
                            <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-[2rem] shadow-sm transition-all ${msg.role === 'user'
                                ? `bg-slate-900 text-white ${isRTL ? 'rounded-tl-none' : 'rounded-tr-none'}`
                                : `bg-white/90 backdrop-blur-md text-slate-800 ${isRTL ? 'rounded-tr-none' : 'rounded-tl-none'} border border-slate-100`
                            }`}>
                                <div className={`text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {msg.content}
                                </div>
                                <div className={`flex items-center gap-1.5 mt-3 opacity-30 text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
                                    <i className={`bx ${msg.role === 'user' ? 'bx-user' : 'bx-bot'}`}></i>
                                    <span>{msg.role === 'user' ? 'Agriculteur' : 'AgroBot'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && !isInitialLoading && (
                        <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                            <div className={`bg-white/90 backdrop-blur-md p-5 rounded-[2rem] ${isRTL ? 'rounded-tr-none' : 'rounded-tl-none'} border border-slate-100 shadow-sm`}>
                                <div className="flex gap-2 items-center h-4">
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} className="h-2 clear-both" />
                </div>

                {/* Input Area */}
                <div className="p-4 md:px-10 md:pb-8 z-20 bg-gradient-to-t from-white/80 via-white/50 to-transparent">
                    <div className="max-w-4xl mx-auto">

                        {/* Quick suggestions — shown only at start */}
                        {messages.length < 2 && !isInitialLoading && (
                            <div className={`flex gap-2 overflow-x-auto mb-4 pb-1 no-scrollbar ${isRTL ? 'flex-row-reverse' : ''}`}>
                                {suggestions.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSendMessage(s)}
                                        className="bg-white/80 backdrop-blur border border-slate-200 px-5 py-2.5 rounded-2xl text-[10px] font-black text-slate-500 hover:bg-[#1DB954] hover:text-white hover:border-[#1DB954] transition-all whitespace-nowrap uppercase tracking-widest active:scale-95 shadow-sm"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative shadow-[0_8px_40px_rgba(0,0,0,0.08)] rounded-3xl overflow-hidden">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Posez votre question à notre IA..."
                                className={`w-full bg-white border-2 border-transparent rounded-3xl h-16 ${isRTL ? 'pr-6 pl-20 text-right' : 'pl-6 pr-20 text-left'} focus:border-[#1DB954]/30 outline-none font-bold text-slate-800 transition-all text-base placeholder:text-slate-300`}
                            />
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={!input.trim() || isTyping}
                                className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-3 w-10 h-10 bg-[#1DB954] text-white rounded-2xl shadow-lg shadow-green-500/20 flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all z-10`}
                            >
                                <i className={`bx bxs-send text-xl ${isRTL ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── DELETE CONFIRMATION MODAL ── */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border border-slate-50">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                            <i className='bx bx-trash-alt text-4xl'></i>
                        </div>
                        <h3 className="text-xl font-black mb-2 text-slate-900 uppercase tracking-wide">
                            {deleteMode === 'all' ? "Effacer l'historique ?" : 'Supprimer ?'}
                        </h3>
                        <p className="text-slate-500 mb-8 font-bold text-sm">
                            {deleteMode === 'all' ? "Toutes vos conversations AgroBot seront effacées définitivement." : 'Cette session sera effacée définitivement.'}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                className="bg-red-500 hover:bg-red-600 text-white p-3.5 rounded-2xl font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all text-xs tracking-widest uppercase"
                            >
                                {deleteMode === 'all' ? 'Oui, tout effacer' : 'Oui, Supprimer'}
                            </button>
                            <button
                                onClick={() => { setShowDeleteModal(false); setChatToDelete(null); }}
                                className="bg-slate-100 text-slate-600 p-3.5 rounded-2xl font-bold hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-chat-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-chat-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
                .custom-chat-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default AgroBot;
