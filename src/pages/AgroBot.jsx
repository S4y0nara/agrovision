import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spline from '@splinetool/react-spline';
import { useLanguage } from '../context/LanguageContext';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * AGROBOT - WHITE & GREEN EDITION (LIGHT PREMIUM)
 * 
 * Enhancements:
 * - Fluid White & Vibrant Green fresh design.
 * - Glassmorphism UI for light mode.
 * - High-visibility 3D Spline on light background.
 * - Sophisticated shadows and minimalist borders.
 */
const AgroBot = () => {
    const { t, lang } = useLanguage();
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
    const [isInitialLoading, setIsInitialLoading] = useState(false);

    const suggestions = [
        t('bot_suggestion_1') || "Mildiou ?",
        t('bot_suggestion_2') || "Semis blé ?",
        t('bot_suggestion_3') || "Irrigation ?",
        t('bot_suggestion_4') || "Feuilles jaunes ?"
    ];

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_URL}/history`);
                if (res.ok) {
                    const data = await res.json();
                    setConversations(data);
                }
            } catch (err) {
                console.error("History fetch error:", err);
            }
        };
        fetchHistory();
    }, [currentChatId]);

    useEffect(() => {
        if (urlChatId) {
            if (urlChatId !== currentChatId) {
                loadConversation(urlChatId);
            }
        } else {
            setMessages([getWelcomeMessage()]);
            setCurrentChatId(null);
        }
    }, [urlChatId, getWelcomeMessage]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const loadConversation = async (id) => {
        if (!id) return;
        setIsInitialLoading(true);
        try {
            const res = await fetch(`${API_URL}/${id}`);
            if (res.ok) {
                const data = await res.json();
                const visibleMessages = data.messages
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
        navigate('/AgroBot');
        setShowSidebar(false);
    };

    const handleSendMessage = async (text) => {
        const msgText = text || input;
        if (!msgText.trim()) return;

        const userMsg = { role: 'user', content: msgText };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msgText,
                    conversationId: currentChatId
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

                if (!currentChatId && data.conversationId) {
                    setCurrentChatId(data.conversationId);
                    navigate(`/AgroBot/${data.conversationId}`, { replace: true });
                }
            }
        } catch (err) {
            console.error("Send error:", err);
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Erreur serveur. Vérifiez votre connexion." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const confirmDelete = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setChatToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!chatToDelete) return;
        const id = chatToDelete;

        setShowDeleteModal(false);
        setConversations(prev => prev.filter(c => c._id !== id));
        if (currentChatId === id) startNewChat();

        try {
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Delete failed on server");
        } catch (err) {
            console.error("Delete error:", err);
            fetchHistory();
            alert("Erreur lors de la suppression.");
        } finally {
            setChatToDelete(null);
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-sans pt-16 selection:bg-[#1DB954]/20">

            {/* 1. SIDEBAR - FRESH WHITE DESIGN */}
            <div className={`fixed inset-y-0 left-0 pt-20 z-40 w-80 bg-slate-50/90 backdrop-blur-xl border-r border-slate-200 transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] md:translate-x-0 ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:static flex flex-col`}>

                <div className="p-8 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#1DB954] rounded-xl shadow-[0_5px_15px_rgba(29,185,84,0.3)]">
                            <i className='bx bx-history text-white text-xl'></i>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Historique</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-chat-scrollbar">
                    <button
                        onClick={startNewChat}
                        className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#1DB954] transition-all duration-300 shadow-xl group active:scale-95"
                    >
                        <i className='bx bx-plus-circle text-xl group-hover:rotate-90 transition-transform'></i>
                        <span className="text-[10px] tracking-widest uppercase">Nouveau Chat</span>
                    </button>

                    <div className="h-4"></div>

                    {conversations.map(chat => (
                        <div
                            key={chat._id}
                            onClick={() => loadConversation(chat._id)}
                            className={`group relative p-4 rounded-2xl cursor-pointer border transition-all duration-300 ${currentChatId === chat._id
                                ? 'bg-white border-[#1DB954] text-[#1DB954] shadow-lg shadow-green-500/10'
                                : 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:shadow-md'}`}
                        >
                            <p className="text-sm font-bold truncate pr-10 text-left">{chat.title || "Consultation"}</p>
                            <div className="flex items-center gap-2 mt-1 opacity-50">
                                <span className="text-[10px] font-bold">
                                    {new Date(chat.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                            <button
                                onClick={(e) => confirmDelete(e, chat._id)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                            >
                                <i className='bx bx-trash-alt text-lg'></i>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overlay */}
            {showSidebar && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden animate-fade-in" onClick={() => setShowSidebar(false)}></div>
            )}

            {/* 2. MAIN CHAT AREA - BRIGHT & CLEAR */}
            <div className="flex-1 flex flex-col relative bg-slate-50/30 overflow-hidden">

                {/* HIGH VISIBILITY 3D SPLINE */}
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none transform scale-110">
                    <Spline scene="https://prod.spline.design/hVGVRMoBFjvVfPV3/scene.splinecode" />
                </div>

                {/* Header - Minimalist Glass */}
                <div className="flex-none p-4 md:px-12 border-b border-slate-100 flex items-center justify-between bg-white/70 backdrop-blur-xl z-20">
                    <div className="flex items-center gap-5">
                        <button onClick={() => setShowSidebar(true)} className="md:hidden text-3xl text-slate-800">
                            <i className='bx bx-menu-alt-left'></i>
                        </button>
                        <div className="w-12 h-12 bg-[#1DB954] rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-green-500/20">
                            <i className='bx bx-bot'></i>
                        </div>
                        <div className="text-left">
                            <h1 className="font-black text-slate-900 leading-tight tracking-tighter uppercase text-xl">AgroBot <span className="text-[#1DB954]">Expert</span></h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('bot_specialist')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-8 z-10 custom-chat-scrollbar relative scroll-smooth">

                    {isInitialLoading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-xl z-30 flex flex-col items-center justify-center animate-fade-in">
                            <div className="w-12 h-12 border-4 border-slate-100 rounded-full relative">
                                <div className="absolute top-0 w-12 h-12 border-4 border-[#1DB954] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="mt-4 font-black text-slate-800 tracking-widest uppercase text-xs">Synchronisation...</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`max-w-[85%] md:max-w-[70%] p-6 rounded-[2.5rem] shadow-sm transition-all duration-300 ${msg.role === 'user'
                                ? 'bg-slate-900 text-white rounded-tr-none'
                                : 'bg-white/90 backdrop-blur-md text-slate-800 rounded-tl-none border border-slate-100'
                                }`}>
                                <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap text-left font-medium">
                                    {msg.content}
                                </div>
                                <div className={`flex items-center gap-2 mt-4 opacity-30 text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <i className={`bx ${msg.role === 'user' ? 'bx-user' : 'bx-bot'}`}></i>
                                    <span>{msg.role === 'user' ? 'Agriculteur' : 'AgroBot'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && !isInitialLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2.5rem] rounded-tl-none border border-slate-100 shadow-sm">
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} className="h-2 clear-both" />
                </div>

                {/* Input Area - Floating Glass */}
                <div className="p-4 md:p-10 z-20">
                    <div className="max-w-4xl mx-auto">

                        {messages.length < 2 && !isInitialLoading && (
                            <div className="flex gap-2 overflow-x-auto mb-6 pb-2 no-scrollbar scroll-smooth">
                                {suggestions.map((s, idx) => (
                                    <button key={idx} onClick={() => handleSendMessage(s)} className="bg-white/80 backdrop-blur border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black text-slate-500 hover:bg-[#1DB954] hover:text-white transition-all whitespace-nowrap uppercase tracking-widest active:scale-95 shadow-sm">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative group shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl overflow-hidden animate-fade-in">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Posez votre question à notre IA..."
                                className="w-full bg-white border-2 border-transparent rounded-3xl h-16 pl-8 pr-20 focus:border-[#1DB954]/20 outline-none font-bold text-slate-800 transition-all text-lg placeholder:text-slate-300"
                            />
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={!input.trim() || isTyping}
                                className="absolute right-3 top-3 w-10 h-10 bg-[#1DB954] text-white rounded-2xl shadow-lg shadow-green-500/20 flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all z-10"
                            >
                                <i className='bx bxs-send text-xl'></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
                    <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center border border-slate-50 animate-scale-in">
                        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-red-500">
                            <i className='bx bx-trash-alt text-4xl'></i>
                        </div>
                        <h3 className="text-2xl font-black mb-2 text-slate-900 uppercase">Supprimer ?</h3>
                        <p className="text-slate-500 mb-8 font-bold text-sm">Cette session sera effacée définitivement.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleDelete} className="bg-red-500 text-white p-4 rounded-2xl font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all text-xs tracking-widest uppercase">Oui, Supprimer</button>
                            <button onClick={() => setShowDeleteModal(false)} className="bg-slate-100 text-slate-600 p-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest">Annuler</button>
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
            `}</style>
        </div>
    );
};

export default AgroBot;
