import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const API = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

const chartColors = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const diseaseKeys = ['Early Blight', 'Late Blight', 'Healthy'];

const currency = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatMoney = (value) => `${currency.format(Number(value || 0))} DT`;
const formatNumber = (value) => numberFormatter.format(Number(value || 0));
const formatDate = (value) => value ? dateFormatter.format(new Date(value)) : '-';

const parsePrice = (value) => {
    if (typeof value === 'number') return value;
    const normalized = String(value || '').replace(',', '.').replace(/[^\d.]/g, '');
    return Number.parseFloat(normalized) || 0;
};

const normalizeDiseaseClass = (value) => {
    const text = String(value || '').toLowerCase();
    if (text.includes('healthy') || text.includes('sain') || text.includes('saine') || text.includes('صحي') || text.includes('سليم')) return 'Healthy';
    if (text.includes('late') || text.includes('tardif') || text.includes('mildiou') || text.includes('متأخر')) return 'Late Blight';
    if (text.includes('early') || text.includes('précoce') || text.includes('precoce') || text.includes('alternariose') || text.includes('مبكر')) return 'Early Blight';
    return 'Early Blight';
};

const statusLabel = {
    pending: 'En attente',
    processing: 'En preparation',
    shipped: 'Expediee',
    delivered: 'Livree',
    cancelled: 'Annulee'
};

const statusClass = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    shipped: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
};

const roleClass = {
    admin: 'bg-violet-50 text-violet-700 border-violet-200',
    seller: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    user: 'bg-slate-50 text-slate-700 border-slate-200'
};

const emptyState = (label) => (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">
        {label}
    </div>
);

const AdminDashboard = () => {
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sellerRequests, setSellerRequests] = useState([]);
    const [scans, setScans] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(() => (
        typeof window === 'undefined' ? true : window.innerWidth >= 768
    ));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const fetchJson = useCallback(async (url, options = {}) => {
        const response = await fetch(url, options);
        if (response.status === 401 || response.status === 403) {
            logout();
            navigate('/admin-login');
            throw new Error('Session admin expiree');
        }
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || body.error || `Erreur serveur ${response.status}`);
        }
        return response.json();
    }, [logout, navigate]);

    const loadAdminData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const headers = authHeaders;
            const [statsData, ordersData, usersData, productsData, sellerRequestsData, scansData, messagesData] = await Promise.all([
                fetchJson(`${API}/api/admin/dashboard-stats`, { headers }),
                fetchJson(`${API}/api/admin/orders`, { headers }),
                fetchJson(`${API}/api/admin/users`, { headers }),
                fetchJson(`${API}/api/admin/products`, { headers }),
                fetchJson(`${API}/api/admin/seller-requests`, { headers }),
                fetchJson(`${API}/api/admin/scans`, { headers }),
                fetchJson(`${API}/api/contact`, { headers })
            ]);

            setStats(statsData || {});
            setOrders(Array.isArray(ordersData) ? ordersData : []);
            setUsers(Array.isArray(usersData) ? usersData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);
            setSellerRequests(Array.isArray(sellerRequestsData) ? sellerRequestsData : []);
            setScans(Array.isArray(scansData) ? scansData : []);
            setMessages(Array.isArray(messagesData) ? messagesData : []);
        } catch (err) {
            setError(err.message || 'Impossible de charger le tableau de bord.');
        } finally {
            setLoading(false);
        }
    }, [authHeaders, fetchJson]);

    useEffect(() => {
        if (!user || user.role !== 'admin' || !token) {
            navigate('/admin-login');
            return;
        }

        loadAdminData();
    }, [user, token, navigate, loadAdminData]);

    const analytics = useMemo(() => {
        const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const deliveredRevenue = orders
            .filter(order => order.status === 'delivered')
            .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const openOrders = orders.filter(order => ['pending', 'processing', 'shipped'].includes(order.status)).length;
        const soldUnits = orders.reduce((sum, order) => {
            return sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0);
        }, 0);
        const totalInventoryValue = products.reduce((sum, product) => {
            return sum + parsePrice(product.price) * Number(product.stock || 0);
        }, 0);
        const lowStock = products.filter(product => Number(product.stock || 0) <= 3).length;
        const sellers = users.filter(item => item.role === 'seller').length;
        const bannedUsers = users.filter(item => item.isBanned).length;
        const unreadMessages = messages.filter(message => message.status === 'unread').length;
        const pendingSellerRequests = sellerRequests.filter(request => request.status === 'pending').length;
        const avgConfidence = scans.length
            ? scans.reduce((sum, scan) => sum + Number(scan.confidence || 0), 0) / scans.length
            : Number(stats?.avgConfidence || 0);
        const healthyScans = scans.filter(scan => /healthy|sain|سليم|سليمة/i.test(scan.disease || '')).length;
        const diseaseScans = Math.max(0, scans.length - healthyScans);

        const diseaseMap = new Map(diseaseKeys.map(key => [key, 0]));
        scans.forEach(scan => {
            const label = normalizeDiseaseClass(scan.disease);
            diseaseMap.set(label, (diseaseMap.get(label) || 0) + 1);
        });
        const diseaseData = diseaseKeys.map(name => ({ name, value: diseaseMap.get(name) || 0 }));

        const scanTrendMap = new Map();
        scans.forEach(scan => {
            const date = scan.createdAt ? new Date(scan.createdAt).toISOString().slice(0, 10) : 'Unknown';
            scanTrendMap.set(date, (scanTrendMap.get(date) || 0) + 1);
        });
        const scanTrend = [...scanTrendMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-14)
            .map(([date, value]) => ({ date: date.slice(5), Scans: value }));

        const orderStatusData = orderStatuses.map(status => ({
            name: statusLabel[status],
            value: orders.filter(order => order.status === status).length
        })).filter(item => item.value > 0);

        const revenueTrendMap = new Map();
        orders.forEach(order => {
            const date = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : 'Unknown';
            const current = revenueTrendMap.get(date) || { date: date.slice(5), Revenue: 0, Orders: 0 };
            current.Revenue += Number(order.totalAmount || 0);
            current.Orders += 1;
            revenueTrendMap.set(date, current);
        });
        const revenueTrend = [...revenueTrendMap.values()]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-14);

        return {
            totalRevenue,
            deliveredRevenue,
            openOrders,
            soldUnits,
            totalInventoryValue,
            lowStock,
            sellers,
            bannedUsers,
            unreadMessages,
            pendingSellerRequests,
            avgConfidence,
            healthyScans,
            diseaseScans,
            diseaseData,
            scanTrend: scanTrend.length ? scanTrend : (stats?.scanTrend || []).map(item => ({ date: item.date?.slice(5), Scans: item.scans })),
            orderStatusData,
            revenueTrend
        };
    }, [orders, products, scans, stats, users, messages, sellerRequests]);

    const translatedDiseaseData = useMemo(() => analytics.diseaseData.map(item => ({
        ...item,
        name: item.name === 'Healthy'
            ? (t('Potato_Healthy') || t('Healthy'))
            : item.name === 'Late Blight'
                ? (t('Potato_Late_Blight') || t('Late_Blight'))
                : (t('Potato_Early_Blight') || t('Early_Blight'))
    })), [analytics.diseaseData, t]);

    const navItems = [
        { id: 'dashboard', label: 'Vue generale', icon: 'bx-grid-alt' },
        { id: 'orders', label: 'Commandes', icon: 'bx-receipt', badge: analytics.openOrders },
        { id: 'scans', label: 'Scans IA', icon: 'bx-scan' },
        { id: 'sellerRequests', label: 'Demandes vente', icon: 'bx-store-alt', badge: analytics.pendingSellerRequests },
        { id: 'products', label: 'Marketplace', icon: 'bx-package', badge: analytics.lowStock },
        { id: 'users', label: 'Utilisateurs', icon: 'bx-group' },
        { id: 'messages', label: 'Support', icon: 'bx-envelope', badge: analytics.unreadMessages }
    ];

    const titles = {
        dashboard: 'Pilotage AgroVision',
        orders: 'Operations commerciales',
        scans: 'Analyse des diagnostics IA',
        sellerRequests: 'Validation des ventes',
        products: 'Controle marketplace',
        users: 'Gestion des utilisateurs',
        messages: 'Support client'
    };

    const handleLogout = () => {
        logout();
        navigate('/admin-login');
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('Supprimer ce produit du catalogue ?')) return;
        try {
            await fetchJson(`${API}/api/admin/products/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            setProducts(current => current.filter(product => product._id !== id));
        } catch (err) {
            window.alert(err.message);
        }
    };

    const handleToggleBanUser = async (id, currentStatus) => {
        const action = currentStatus ? 'reactiver' : 'suspendre';
        if (!window.confirm(`Confirmer: ${action} cet utilisateur ?`)) return;
        try {
            const data = await fetchJson(`${API}/api/admin/users/${id}/ban`, {
                method: 'PUT',
                headers: authHeaders
            });
            setUsers(current => current.map(item => item._id === id ? { ...item, isBanned: data.isBanned } : item));
        } catch (err) {
            window.alert(err.message);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Supprimer definitivement ce compte ?')) return;
        try {
            await fetchJson(`${API}/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            setUsers(current => current.filter(item => item._id !== id));
        } catch (err) {
            window.alert(err.message);
        }
    };

    const handleOrderStatus = async (id, status) => {
        try {
            const updated = await fetchJson(`${API}/api/admin/orders/${id}/status`, {
                method: 'PUT',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            setOrders(current => current.map(order => order._id === id ? updated : order));
        } catch (err) {
            window.alert(err.message);
        }
    };

    const handleSellerRequestDecision = async (id, decision) => {
        const isApproval = decision === 'approve';
        if (!window.confirm(isApproval ? 'Approuver cette vente et publier le produit ?' : 'Refuser cette demande de vente ?')) return;

        try {
            const data = await fetchJson(`${API}/api/admin/seller-requests/${id}/${decision}`, {
                method: 'PUT',
                headers: authHeaders
            });

            setSellerRequests(current => current.map(request => request._id === id ? data.request : request));
            if (data.product) {
                setProducts(current => [data.product, ...current]);
            }
            if (data.request?.user) {
                setUsers(current => current.map(item => item._id === data.request.user._id ? { ...item, role: data.request.user.role || 'seller' } : item));
            }
        } catch (err) {
            window.alert(err.message);
        }
    };

    const handleMarkRead = async (id) => {
        try {
            const updated = await fetchJson(`${API}/api/contact/${id}`, {
                method: 'PATCH',
                headers: authHeaders
            });
            setMessages(current => current.map(message => message._id === id ? updated : message));
            setSelectedMessage(current => current?._id === id ? updated : current);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!window.confirm('Supprimer ce message ?')) return;
        try {
            await fetchJson(`${API}/api/contact/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            setMessages(current => current.filter(message => message._id !== id));
            setSelectedMessage(current => current?._id === id ? null : current);
        } catch (err) {
            window.alert(err.message);
        }
    };

    const resolveImage = (image) => {
        if (!image) return 'https://placehold.co/96x96/e2e8f0/64748b?text=IMG';
        if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) return image;
        if (image.startsWith('/')) return `${API}${image}`;
        return `${API}/${image}`;
    };

    const KpiCard = ({ icon, label, value, note, tone = 'emerald' }) => {
        const tones = {
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            blue: 'bg-blue-50 text-blue-700 border-blue-100',
            amber: 'bg-amber-50 text-amber-700 border-amber-100',
            rose: 'bg-rose-50 text-rose-700 border-rose-100',
            violet: 'bg-violet-50 text-violet-700 border-violet-100'
        };

        return (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl ${tones[tone]}`}>
                        <i className={`bx ${icon}`} />
                    </div>
                </div>
                {note && <p className="mt-3 text-xs font-medium text-slate-500">{note}</p>}
            </div>
        );
    };

    const ChartPanel = ({ title, subtitle, children }) => (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
                <h2 className="text-base font-black text-slate-950">{title}</h2>
                {subtitle && <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>}
            </div>
            <div className="h-72">{children}</div>
        </section>
    );

    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon="bx-credit-card" label="Revenu total" value={formatMoney(analytics.totalRevenue)} note={`${formatMoney(analytics.deliveredRevenue)} livre`} tone="emerald" />
                <KpiCard icon="bx-receipt" label="Commandes" value={formatNumber(orders.length)} note={`${formatNumber(analytics.openOrders)} commandes ouvertes`} tone="blue" />
                <KpiCard icon="bx-scan" label="Scans IA" value={formatNumber(scans.length)} note={`Confiance moyenne: ${Number(analytics.avgConfidence || 0).toFixed(1)}%`} tone="violet" />
                <KpiCard icon="bx-package" label="Stock critique" value={formatNumber(analytics.lowStock)} note={`Valeur stock: ${formatMoney(analytics.totalInventoryValue)}`} tone={analytics.lowStock ? 'rose' : 'amber'} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <ChartPanel title="Evolution des revenus" subtitle="Montants reels issus des commandes">
                    {analytics.revenueTrend.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip formatter={(value) => formatMoney(value)} />
                                <Line type="monotone" dataKey="Revenue" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : emptyState('Aucune commande enregistree')}
                </ChartPanel>

                <ChartPanel title="Pipeline commandes" subtitle="Repartition par statut">
                    {analytics.orderStatusData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.orderStatusData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} name="Commandes" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : emptyState('Aucune commande')}
                </ChartPanel>

                <ChartPanel title="Maladies detectees" subtitle="Basee sur les scans sauvegardes">
                    {translatedDiseaseData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={translatedDiseaseData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                                    {translatedDiseaseData.map((_, index) => (
                                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : emptyState('Aucun scan sauvegarde')}
                </ChartPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-950">Activite recente</h2>
                            <p className="mt-1 text-xs font-medium text-slate-500">Derniers diagnostics effectues</p>
                        </div>
                        <button onClick={() => setActiveTab('scans')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                            Voir les scans
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {scans.slice(0, 6).map(scan => (
                            <article key={scan._id} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center gap-3">
                                    <img src={resolveImage(scan.imageUrl)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-950">{scan.disease}</p>
                                        <p className="text-xs font-medium text-slate-500">{scan.user?.fullName || 'Utilisateur inconnu'}</p>
                                        <p className="mt-1 text-xs font-bold text-emerald-700">{scan.confidence}% confiance</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {!scans.length && <div className="md:col-span-2 xl:col-span-3">{emptyState('Aucune activite recente')}</div>}
                    </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-black text-slate-950">Indicateurs rapides</h2>
                    <div className="mt-5 space-y-4">
                        <MetricRow label="Utilisateurs" value={formatNumber(users.length)} detail={`${formatNumber(analytics.sellers)} vendeurs`} />
                        <MetricRow label="Comptes suspendus" value={formatNumber(analytics.bannedUsers)} detail="Controle d'acces" />
                        <MetricRow label="Demandes de vente" value={formatNumber(analytics.pendingSellerRequests)} detail="A valider avant publication" />
                        <MetricRow label="Unites vendues" value={formatNumber(analytics.soldUnits)} detail="Toutes commandes" />
                        <MetricRow label="Scans malades" value={formatNumber(analytics.diseaseScans)} detail={`${formatNumber(analytics.healthyScans)} scans sains`} />
                        <MetricRow label="Messages non lus" value={formatNumber(analytics.unreadMessages)} detail="Support client" />
                    </div>
                </section>
            </div>
        </div>
    );

    const MetricRow = ({ label, value, detail }) => (
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <div>
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className="text-xs font-medium text-slate-500">{detail}</p>
            </div>
            <p className="text-xl font-black text-slate-950">{value}</p>
        </div>
    );

    const renderOrders = () => (
        <DataPanel title="Commandes" subtitle={`${orders.length} commandes, ${formatMoney(analytics.totalRevenue)} de revenu total`}>
            <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <Th>Client</Th>
                        <Th>Articles</Th>
                        <Th>Total</Th>
                        <Th>Statut</Th>
                        <Th>Paiement</Th>
                        <Th>Date</Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
                        <tr key={order._id} className="hover:bg-slate-50/70">
                            <Td>
                                <p className="font-bold text-slate-950">{order.user?.fullName || 'Client inconnu'}</p>
                                <p className="text-xs text-slate-500">{order.user?.email || '-'}</p>
                            </Td>
                            <Td>
                                <p className="font-bold text-slate-700">{(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} unite(s)</p>
                                <p className="max-w-[260px] truncate text-xs text-slate-500">{(order.items || []).map(item => item.product?.name || 'Produit').join(', ')}</p>
                            </Td>
                            <Td><span className="font-black text-slate-950">{formatMoney(order.totalAmount)}</span></Td>
                            <Td>
                                <select
                                    value={order.status}
                                    onChange={(event) => handleOrderStatus(order._id, event.target.value)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-black outline-none ${statusClass[order.status] || statusClass.pending}`}
                                >
                                    {orderStatuses.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}
                                </select>
                            </Td>
                            <Td><span className="text-sm font-semibold text-slate-600">{order.paymentMethod || '-'}</span></Td>
                            <Td><span className="text-sm font-semibold text-slate-500">{formatDate(order.createdAt)}</span></Td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!orders.length && emptyState('Aucune commande')}
        </DataPanel>
    );

    const renderScans = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard icon="bx-scan" label="Scans sauvegardes" value={formatNumber(scans.length)} note="Diagnostics utilisateurs" tone="blue" />
                <KpiCard icon="bx-line-chart" label="Confiance moyenne" value={`${Number(analytics.avgConfidence || 0).toFixed(1)}%`} note="Moyenne des predictions" tone="emerald" />
                <KpiCard icon="bx-plus-medical" label="Cas a surveiller" value={formatNumber(analytics.diseaseScans)} note="Scans non sains" tone="rose" />
            </div>
            <ChartPanel title="Volume des scans" subtitle="Scans sauvegardes par jour">
                {analytics.scanTrend.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.scanTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <RechartsTooltip />
                            <Line type="monotone" dataKey="Scans" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : emptyState('Aucune donnee de scan')}
            </ChartPanel>
            <DataPanel title="Historique des scans" subtitle="Toutes les analyses sauvegardees">
                <table className="w-full min-w-[860px] text-left">
                    <thead className="bg-slate-50">
                        <tr>
                            <Th>Image</Th>
                            <Th>Diagnostic</Th>
                            <Th>Confiance</Th>
                            <Th>Utilisateur</Th>
                            <Th>Date</Th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {scans.map(scan => (
                            <tr key={scan._id} className="hover:bg-slate-50/70">
                                <Td><img src={resolveImage(scan.imageUrl)} alt="" className="h-12 w-12 rounded-lg object-cover" /></Td>
                                <Td>
                                    <p className="font-black text-slate-950">{scan.disease}</p>
                                    <p className="text-xs text-slate-500">{scan.plantName}</p>
                                </Td>
                                <Td><span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{scan.confidence}%</span></Td>
                                <Td>
                                    <p className="font-bold text-slate-800">{scan.user?.fullName || 'Utilisateur inconnu'}</p>
                                    <p className="text-xs text-slate-500">{scan.user?.email || '-'}</p>
                                </Td>
                                <Td><span className="text-sm font-semibold text-slate-500">{formatDate(scan.createdAt)}</span></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!scans.length && emptyState('Aucun scan sauvegarde')}
            </DataPanel>
        </div>
    );

    const renderSellerRequests = () => (
        <DataPanel
            title="Demandes de vente"
            subtitle={`${sellerRequests.filter(request => request.status === 'pending').length} demande(s) en attente`}
        >
            <table className="w-full min-w-[980px] text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <Th>Produit</Th>
                        <Th>Vendeur</Th>
                        <Th>Prix / Stock</Th>
                        <Th>Statut</Th>
                        <Th>Date</Th>
                        <Th>Actions</Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sellerRequests.map(request => (
                        <tr key={request._id} className="hover:bg-slate-50/70">
                            <Td>
                                <div className="flex items-center gap-3">
                                    <img src={resolveImage(request.productImage)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-slate-950">{request.productName || request.productType}</p>
                                        <p className="max-w-[320px] truncate text-xs text-slate-500">{request.description || 'Aucune description'}</p>
                                    </div>
                                </div>
                            </Td>
                            <Td>
                                <p className="font-bold text-slate-800">{request.companyName || request.user?.fullName || 'Vendeur'}</p>
                                <p className="text-xs text-slate-500">{request.user?.email || request.phone || '-'}</p>
                            </Td>
                            <Td>
                                <p className="font-black text-emerald-700">{request.price}</p>
                                <p className="text-xs font-bold text-slate-500">Stock: {request.stock ?? 0}</p>
                            </Td>
                            <Td>
                                <span className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${request.status === 'approved'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : request.status === 'rejected'
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                    }`}>
                                    {request.status || 'pending'}
                                </span>
                            </Td>
                            <Td><span className="text-sm font-semibold text-slate-500">{formatDate(request.createdAt)}</span></Td>
                            <Td>
                                {request.status === 'pending' ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSellerRequestDecision(request._id, 'approve')}
                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                                        >
                                            Approuver
                                        </button>
                                        <button
                                            onClick={() => handleSellerRequestDecision(request._id, 'reject')}
                                            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white"
                                        >
                                            Refuser
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400">Decision prise</span>
                                )}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!sellerRequests.length && emptyState('Aucune demande de vente')}
        </DataPanel>
    );

    const renderProducts = () => (
        <DataPanel title="Marketplace" subtitle={`${products.length} produits, ${analytics.lowStock} stock critique`}>
            <table className="w-full min-w-[920px] text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <Th>Produit</Th>
                        <Th>Categorie</Th>
                        <Th>Vendeur</Th>
                        <Th>Prix</Th>
                        <Th>Stock</Th>
                        <Th>Actions</Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {products.map(product => (
                        <tr key={product._id} className="hover:bg-slate-50/70">
                            <Td>
                                <div className="flex items-center gap-3">
                                    <img src={resolveImage(product.image)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-slate-950">{product.name}</p>
                                        <p className="max-w-[280px] truncate text-xs text-slate-500">{product.desc}</p>
                                    </div>
                                </div>
                            </Td>
                            <Td><span className="text-sm font-bold text-slate-700">{product.category}</span></Td>
                            <Td>
                                <p className="font-bold text-slate-800">{product.seller?.fullName || 'AgroVision'}</p>
                                <p className="text-xs text-slate-500">{product.seller?.email || 'Catalogue interne'}</p>
                            </Td>
                            <Td><span className="font-black text-emerald-700">{product.price}</span></Td>
                            <Td>
                                <span className={`rounded-lg px-3 py-1 text-xs font-black ${Number(product.stock || 0) <= 3 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {product.stock ?? 0}
                                </span>
                            </Td>
                            <Td>
                                <button onClick={() => handleDeleteProduct(product._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white">
                                    Supprimer
                                </button>
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!products.length && emptyState('Aucun produit')}
        </DataPanel>
    );

    const renderUsers = () => (
        <DataPanel title="Utilisateurs" subtitle={`${users.length} comptes, ${analytics.sellers} vendeurs, ${analytics.bannedUsers} suspendus`}>
            <table className="w-full min-w-[860px] text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <Th>Utilisateur</Th>
                        <Th>Role</Th>
                        <Th>Verification</Th>
                        <Th>Inscription</Th>
                        <Th>Actions</Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(item => (
                        <tr key={item._id} className="hover:bg-slate-50/70">
                            <Td>
                                <p className={`font-black ${item.isBanned ? 'text-slate-400 line-through' : 'text-slate-950'}`}>{item.fullName}</p>
                                <p className="text-xs text-slate-500">{item.email}</p>
                            </Td>
                            <Td>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${roleClass[item.role] || roleClass.user}`}>{item.role}</span>
                                    {item.isBanned && <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black uppercase text-rose-700">Suspendu</span>}
                                </div>
                            </Td>
                            <Td>
                                <span className={`rounded-lg px-3 py-1 text-xs font-black ${item.isEmailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {item.isEmailVerified ? 'Verifie' : 'Non verifie'}
                                </span>
                            </Td>
                            <Td><span className="text-sm font-semibold text-slate-500">{formatDate(item.createdAt)}</span></Td>
                            <Td>
                                {item.role !== 'admin' ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleToggleBanUser(item._id, item.isBanned)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-amber-300 hover:text-amber-700">
                                            {item.isBanned ? 'Reactiver' : 'Suspendre'}
                                        </button>
                                        <button onClick={() => handleDeleteUser(item._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white">
                                            Supprimer
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400">Protege</span>
                                )}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!users.length && emptyState('Aucun utilisateur')}
        </DataPanel>
    );

    const renderMessages = () => (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                    <h2 className="text-base font-black text-slate-950">Boite de reception</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">{analytics.unreadMessages} message(s) non lu(s)</p>
                </div>
                <div className="max-h-[640px] overflow-y-auto">
                    {messages.map(message => (
                        <button
                            key={message._id}
                            onClick={() => {
                                setSelectedMessage(message);
                                if (message.status === 'unread') handleMarkRead(message._id);
                            }}
                            className={`w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selectedMessage?._id === message._id ? 'bg-emerald-50/60' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-black text-slate-950">{message.name}</p>
                                {message.status === 'unread' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-slate-600">{message.subject || 'Sans sujet'}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{message.message}</p>
                        </button>
                    ))}
                    {!messages.length && <div className="p-5">{emptyState('Aucun message')}</div>}
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                {selectedMessage ? (
                    <div className="flex min-h-[520px] flex-col">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <h2 className="text-xl font-black text-slate-950">{selectedMessage.subject || 'Sans sujet'}</h2>
                                <p className="mt-2 text-sm font-bold text-slate-700">{selectedMessage.name}</p>
                                <p className="text-sm text-slate-500">{selectedMessage.email}</p>
                                <p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(selectedMessage.createdAt)}</p>
                            </div>
                            <div className="flex gap-2">
                                <a href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject || '')}`} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">
                                    Repondre
                                </a>
                                <button onClick={() => handleDeleteMessage(selectedMessage._id)} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white">
                                    Supprimer
                                </button>
                            </div>
                        </div>
                        <div className="mt-5 flex-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                            {selectedMessage.message}
                        </div>
                    </div>
                ) : (
                    emptyState('Selectionnez un message')
                )}
            </section>
        </div>
    );

    const DataPanel = ({ title, subtitle, children }) => (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
                <h2 className="text-base font-black text-slate-950">{title}</h2>
                {subtitle && <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>}
            </div>
            <div className="overflow-x-auto">{children}</div>
        </section>
    );

    const Th = ({ children }) => (
        <th className="px-5 py-4 text-xs font-black uppercase tracking-wide text-slate-500">{children}</th>
    );

    const Td = ({ children }) => (
        <td className="px-5 py-4 align-middle">{children}</td>
    );

    if (!user || user.role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            {sidebarOpen && (
                <button
                    aria-label="Fermer le menu admin"
                    className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-20'}`}>
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <button onClick={() => navigate('/')} className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen ? 'justify-center' : ''}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                            <img src="/agrovision.png" alt="AgroVision" className="h-9 w-9 object-contain" />
                        </span>
                        {sidebarOpen && (
                            <span className="text-left">
                                <span className="block text-sm font-black text-slate-950">AgroVision</span>
                                <span className="block text-xs font-semibold text-slate-500">Admin console</span>
                            </span>
                        )}
                    </button>
                    <button onClick={() => setSidebarOpen(value => !value)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        <i className={`bx ${sidebarOpen ? 'bx-chevron-left' : 'bx-menu'} text-xl`} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-black transition ${activeTab === item.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'} ${!sidebarOpen ? 'justify-center' : ''}`}
                        >
                            <i className={`bx ${item.icon} text-xl`} />
                            {sidebarOpen && <span>{item.label}</span>}
                            {item.badge > 0 && (
                                <span className={`ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white ${!sidebarOpen ? 'absolute right-1 top-1' : ''}`}>
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="border-t border-slate-100 p-3">
                    <button onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-black text-rose-700 hover:bg-rose-50 ${!sidebarOpen ? 'justify-center' : ''}`}>
                        <i className="bx bx-log-out text-xl" />
                        {sidebarOpen && <span>Deconnexion</span>}
                    </button>
                </div>
            </aside>

            <main className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-72' : 'md:ml-20'}`}>
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                aria-label="Ouvrir le menu admin"
                                onClick={() => setSidebarOpen(true)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
                            >
                                <i className="bx bx-menu text-xl" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl font-black text-slate-950">{titles[activeTab]}</h1>
                                <p className="truncate text-sm font-medium text-slate-500">Connecte en tant que {user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={loadAdminData} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                                <i className="bx bx-refresh mr-2" />
                                Actualiser
                            </button>
                            <button onClick={() => navigate('/')} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                                Site public
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-6">
                    {error && (
                        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex h-[520px] items-center justify-center">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'dashboard' && renderDashboard()}
                            {activeTab === 'orders' && renderOrders()}
                            {activeTab === 'scans' && renderScans()}
                            {activeTab === 'sellerRequests' && renderSellerRequests()}
                            {activeTab === 'products' && renderProducts()}
                            {activeTab === 'users' && renderUsers()}
                            {activeTab === 'messages' && renderMessages()}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
