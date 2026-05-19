import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
    const { t } = useLanguage();
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('activity');
    const [selectedObject, setSelectedObject] = useState(null);
    const [viewingScan, setViewingScan] = useState(null);

    // If user is not logged in, redirect them to Auth gateway or show a message
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    const [stats, setStats] = useState({ scans: 0, bought: 0, sold: 0 });
    const [scanHistory, setScanHistory] = useState([]);
    const [marketHistory, setMarketHistory] = useState([]);
    const [activityTimeline, setActivityTimeline] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            try {
                const BaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
                const [statsRes, scansRes] = await Promise.all([
                    fetch(`${BaseUrl}/api/user/${user._id || user.id}/stats`),
                    fetch(`${BaseUrl}/api/scans/${user._id || user.id}`)
                ]);

                if (statsRes.ok && scansRes.ok) {
                    const statsData = await statsRes.json();
                    const scansData = await scansRes.json();

                    setStats(statsData.stats);
                    
                    const formattedScans = scansData.map(s => ({
                        id: s._id,
                        plant: s.plantName,
                        disease: s.disease,
                        date: new Date(s.createdAt).toLocaleDateString(),
                        rawDate: new Date(s.createdAt),
                        health: s.disease.toLowerCase() === 'healthy' ? 'healthy' : 'danger',
                        confidence: s.confidence,
                        treatment: s.treatment,
                        imageUrl: s.imageUrl
                    }));
                    setScanHistory(formattedScans);

                    const formattedMarket = [];
                    const timeline = [];

                    formattedScans.forEach(s => {
                        timeline.push({
                            id: `scan_${s.id}`,
                            type: 'scan',
                            title: `Scan IA : ${s.plant}`,
                            desc: `Diagnostic : ${s.disease} avec ${s.confidence}% de confiance.`,
                            date: s.date,
                            rawDate: s.rawDate
                        });
                    });

                    if (statsData.history) {
                        statsData.history.buyOrders.forEach(b => {
                            const itemName = b.items.filter(i => i.product).map(i => i.product.name).join(', ') || 'Item';
                            formattedMarket.push({
                                id: `buy_${b._id}`,
                                type: 'buy',
                                item: itemName,
                                price: `${b.totalAmount} DT`,
                                date: new Date(b.createdAt).toLocaleDateString(),
                                rawDate: new Date(b.createdAt)
                            });
                            timeline.push({
                                id: `t_buy_${b._id}`,
                                type: 'buy',
                                title: 'Achat Marketplace',
                                desc: `Acheté : ${itemName} pour ${b.totalAmount} DT.`,
                                date: new Date(b.createdAt).toLocaleDateString(),
                                rawDate: new Date(b.createdAt)
                            });
                        });

                        statsData.history.sellOrders.forEach(s => {
                            const itemName = s.items.filter(i => i.product).map(i => i.product.name).join(', ') || 'Item';
                            formattedMarket.push({
                                id: `sell_${s._id}`,
                                type: 'sell',
                                item: itemName,
                                price: `${s.total} DT`,
                                date: new Date(s.createdAt).toLocaleDateString(),
                                rawDate: new Date(s.createdAt)
                            });
                            timeline.push({
                                id: `t_sell_${s._id}`,
                                type: 'sell',
                                title: 'Nouvelle vente Marketplace',
                                desc: `Vendu : ${itemName} pour ${s.total} DT.`,
                                date: new Date(s.createdAt).toLocaleDateString(),
                                rawDate: new Date(s.createdAt)
                            });
                        });
                    }

                    formattedMarket.sort((a,b) => b.rawDate - a.rawDate);
                    setMarketHistory(formattedMarket);
                    
                    timeline.sort((a,b) => b.rawDate - a.rawDate);
                    setActivityTimeline(timeline.slice(0, 15)); 
                }
            } catch (err) {
                console.error("Error fetching profile data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    // Build the Initials Avatar if no photo exists
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) return parts[0][0] + parts[1][0];
        return parts[0][0];
    };

    return (
        <div className="profile-page">
            {/* Ambient Background Blobs */}
            <div className="profile-blob profile-blob-1" />
            <div className="profile-blob profile-blob-2" />

            <div className="profile-container">
                <div className="profile-header-card">
                    <div className="profile-cover">
                        <img src="/gradient.png" alt="Cover" className="cover-img" />
                        <div className="cover-overlay" />
                    </div>

                    <div className="profile-info-section">
                        <div className="profile-avatar-container">
                            {user.avatar ? (
                                <img src={user.avatar} alt="Avatar" className="profile-avatar" />
                            ) : (
                                <div className="profile-avatar-fallback">
                                    {getInitials(user.fullName || user.username)}
                                </div>
                            )}
                            <div className="profile-status-badge"></div>
                        </div>

                        <div className="profile-user-details">
                            <h1 className="profile-name">{user.fullName || user.username || 'Utilisateur'}</h1>
                            <p className="profile-email">{user.email}</p>
                            <div className="profile-meta">
                                <span className="meta-item"><i className="bx bx-calendar"></i> {t('profile_member_since')} 2026</span>
                            </div>
                        </div>

                        <div className="profile-actions">
                            <button className="btn-logout-profile" onClick={logout}><i className="bx bx-log-out"></i> {t('logout')}</button>
                        </div>
                    </div>

                    <div className="profile-stats-row">
                        <div className="profile-stat-box">
                            <div className="stat-icon scans"><i className="bx bx-scan"></i></div>
                            <div className="stat-info">
                                <h3>{stats.scans}</h3>
                                <p>{t('profile_stats_scans')}</p>
                            </div>
                        </div>
                        <div className="profile-stat-box">
                            <div className="stat-icon bought"><i className="bx bx-cart-download"></i></div>
                            <div className="stat-info">
                                <h3>{stats.bought}</h3>
                                <p>{t('profile_stats_bought')}</p>
                            </div>
                        </div>
                        <div className="profile-stat-box">
                            <div className="stat-icon sold"><i className="bx bx-trending-up"></i></div>
                            <div className="stat-info">
                                <h3>{stats.sold}</h3>
                                <p>{t('profile_stats_sold')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="profile-content-grid">
                    {/* Left Column: Navigation Tabs */}
                    <div className="profile-sidebar">
                        <div className="profile-tabs">
                            <button 
                                className={`profile-tab ${activeTab === 'activity' ? 'active' : ''}`}
                                onClick={() => setActiveTab('activity')}
                            >
                                <i className="bx bx-pulse"></i> {t('profile_tab_activity')}
                            </button>
                            <button 
                                className={`profile-tab ${activeTab === 'scans' ? 'active' : ''}`}
                                onClick={() => setActiveTab('scans')}
                            >
                                <i className="bx bx-scan"></i> {t('profile_scan_history')}
                            </button>
                            <button 
                                className={`profile-tab ${activeTab === 'market' ? 'active' : ''}`}
                                onClick={() => setActiveTab('market')}
                            >
                                <i className="bx bx-store-alt"></i> {t('profile_market_history')}
                            </button>
                            <button 
                                className={`profile-tab ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <i className="bx bx-cog"></i> {t('profile_tab_settings')}
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Tab Content */}
                    <div className="profile-tab-content">
                        {activeTab === 'activity' && (
                            <div className="activity-feed animate-fade-in">
                                <h2>{t('profile_tab_activity')}</h2>
                                <div className="activity-timeline">
                                    {loading ? (
                                        <p>Loading activity...</p>
                                    ) : activityTimeline.length > 0 ? (
                                        activityTimeline.map(item => (
                                            <div className="timeline-item" key={item.id}>
                                                <div className={`timeline-icon ${item.type}`}>
                                                    <i className={`bx ${item.type === 'scan' ? 'bx-scan' : item.type === 'buy' ? 'bx-cart' : 'bx-dollar-circle'}`}></i>
                                                </div>
                                                <div className="timeline-content">
                                                    <h4>{item.title}</h4>
                                                    <p>{item.desc}</p>
                                                    <span className="time">{item.date}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p>Aucune activité récente.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'scans' && (
                            <div className="history-section animate-fade-in">
                                <h2>{t('profile_scan_history')}</h2>
                                {loading ? (
                                    <p>Loading...</p>
                                ) : scanHistory.length > 0 ? (
                                    <div className="history-list">
                                        {scanHistory.map(scan => (
                                            <div className="history-card" key={scan.id}>
                                                <div className="card-left">
                                                    <div className={`health-indicator ${scan.health}`}></div>
                                                    <div>
                                                        <h4>{scan.plant}</h4>
                                                        <p className="disease-text">{scan.disease}</p>
                                                    </div>
                                                </div>
                                                <div className="card-right">
                                                    <span className="date-text">{scan.date}</span>
                                                    <button 
                                                        className="btn-small-link" 
                                                        onClick={() => setViewingScan(scan)}
                                                    >
                                                        Voir détails
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <i className="bx bx-scan"></i>
                                        <p>{t('profile_empty_scans')}</p>
                                        <Link to="/scanner" className="btn-primary-small">Scanner maintenant</Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'market' && (
                            <div className="history-section animate-fade-in">
                                <h2>{t('profile_market_history')}</h2>
                                {loading ? (
                                    <p>Loading...</p>
                                ) : marketHistory.length > 0 ? (
                                    <div className="history-list">
                                        {marketHistory.map(item => (
                                            <div className="history-card" key={item.id}>
                                                <div className="card-left">
                                                    <div className={`transaction-icon ${item.type}`}>
                                                        <i className={`bx ${item.type === 'buy' ? 'bx-down-arrow-circle' : 'bx-up-arrow-circle'}`}></i>
                                                    </div>
                                                    <div>
                                                        <h4>{item.item}</h4>
                                                        <p className="type-text">{item.type === 'buy' ? 'Achat' : 'Vente'}</p>
                                                    </div>
                                                </div>
                                                <div className="card-right">
                                                    <span className="price-text font-bold">{item.price}</span>
                                                    <span className="date-text">{item.date}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <i className="bx bx-store-alt"></i>
                                        <p>{t('profile_empty_market')}</p>
                                        <Link to="/marketplace" className="btn-primary-small">Visiter la boutique</Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="settings-section animate-fade-in">
                                <h2>{t('profile_tab_settings')}</h2>
                                <div className="settings-form">
                                    <div className="form-group">
                                        <label>Nom complet</label>
                                        <input type="text" defaultValue={user.fullName || user.username} className="pro-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input type="email" defaultValue={user.email} disabled className="pro-input disabled" />
                                    </div>
                                    <div className="form-group">
                                        <label>Mot de passe</label>
                                        <input type="password" placeholder="••••••••" className="pro-input" />
                                    </div>
                                    <button className="btn-save-settings">Sauvegarder les modifications</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Scan Detail Modal */}
            {viewingScan && (
                <div className="modal-overlay" onClick={() => setViewingScan(null)}>
                    <div className="modal-content scan-detail-modal animate-modal-in" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setViewingScan(null)}>&times;</button>
                        
                        <div className="modal-header">
                            <span className="modal-badge">DIAGNOSTIC DÉTAILLÉ</span>
                            <h2>Analyse du {viewingScan.date}</h2>
                        </div>

                        <div className="modal-body">
                            <div className="scan-detail-grid">
                                <div className="scan-detail-image">
                                    <img src={viewingScan.imageUrl || "/placeholder-plant.png"} alt="Scan" />
                                    <div className="image-overlay-info">
                                        <span className={`health-status-tag ${viewingScan.health}`}>
                                            {viewingScan.health === 'healthy' ? 'Sain' : 'Maladie Détectée'}
                                        </span>
                                    </div>
                                </div>

                                <div className="scan-detail-info">
                                    <div className="info-group">
                                        <label>Plante / Culture</label>
                                        <p className="val">{viewingScan.plant}</p>
                                    </div>
                                    <div className="info-group">
                                        <label>Diagnostic</label>
                                        <p className={`val disease-name ${viewingScan.health}`}>{viewingScan.disease}</p>
                                    </div>
                                    <div className="info-group">
                                        <label>Confiance IA</label>
                                        <div className="confidence-meter">
                                            <div className="meter-bg">
                                                <div className="meter-fill" style={{ width: `${viewingScan.confidence}%` }}></div>
                                            </div>
                                            <span>{viewingScan.confidence}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="scan-detail-treatment">
                                <h3><i className='bx bx-plus-medical'></i> Recommandations de traitement</h3>
                                <div className="treatment-content">
                                    {viewingScan.treatment ? (
                                        <div dangerouslySetInnerHTML={{ __html: viewingScan.treatment.replace(/\n/g, '<br/>') }} />
                                    ) : (
                                        <p>Aucun conseil de traitement spécifique n'a été généré pour ce scan.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-close-modal" onClick={() => setViewingScan(null)}>Fermer</button>
                            <Link to="/agrobot" className="btn-ask-bot">
                                <i className='bx bx-bot'></i> Questionner AgroBot
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
