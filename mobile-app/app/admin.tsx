import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

type TabKey = 'overview' | 'orders' | 'requests' | 'scans' | 'market' | 'users' | 'support';

type AdminStats = {
  usersCount?: number;
  productsCount?: number;
  scansCount?: number;
  ordersCount?: number;
  openOrdersCount?: number;
  totalRevenue?: number;
  deliveredRevenue?: number;
  avgConfidence?: number | string;
  diseaseData?: Array<{ name: string; value: number }>;
};

type Order = {
  _id: string;
  user?: { fullName?: string; email?: string };
  items?: Array<{ quantity?: number; product?: { name?: string } }>;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
};

type Scan = {
  _id: string;
  user?: { fullName?: string; email?: string };
  disease?: string;
  plantName?: string;
  confidence?: number;
  createdAt?: string;
};

type Product = {
  _id: string;
  name?: string;
  category?: string;
  price?: string;
  stock?: number;
  seller?: { fullName?: string; email?: string };
};

type SellerRequest = {
  _id: string;
  user?: { fullName?: string; email?: string; role?: string };
  companyName?: string;
  phone?: string;
  productName?: string;
  productType?: string;
  description?: string;
  price?: string;
  stock?: number;
  productImage?: string;
  status?: string;
  createdAt?: string;
};

type User = {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
  isBanned?: boolean;
  isEmailVerified?: boolean;
};

type Message = {
  _id: string;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  status?: string;
  createdAt?: string;
};

const statusFlow = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const diseaseKeys = ['Early Blight', 'Late Blight', 'Healthy'] as const;

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const formatNumber = (value: number | string | undefined) => Number(value || 0).toLocaleString('fr-FR');
const formatMoney = (value: number | undefined) => `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-');
const normalizeDiseaseClass = (value?: string) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('healthy') || text.includes('sain') || text.includes('saine') || text.includes('صحي') || text.includes('سليم')) return 'Healthy';
  if (text.includes('late') || text.includes('tardif') || text.includes('mildiou') || text.includes('متأخر')) return 'Late Blight';
  if (text.includes('early') || text.includes('précoce') || text.includes('precoce') || text.includes('alternariose') || text.includes('مبكر')) return 'Early Blight';
  return 'Early Blight';
};

export default function AdminScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const requestJson = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('ADMIN_REQUIRED');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || 'Request failed');
    }

    return response.json();
  }, [headers]);

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);

    try {
      const [statsData, ordersData, usersData, productsData, sellerRequestsData, scansData, messagesData] = await Promise.all([
        requestJson('/api/admin/dashboard-stats'),
        requestJson('/api/admin/orders'),
        requestJson('/api/admin/users'),
        requestJson('/api/admin/products'),
        requestJson('/api/admin/seller-requests'),
        requestJson('/api/admin/scans'),
        requestJson('/api/contact'),
      ]);

      setStats(statsData || {});
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setSellerRequests(Array.isArray(sellerRequestsData) ? sellerRequestsData : []);
      setScans(Array.isArray(scansData) ? scansData : []);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
    } catch (error: any) {
      if (error.message === 'ADMIN_REQUIRED') {
        Alert.alert('Admin access required', 'This section is reserved for administrator accounts.');
        router.replace('/(tabs)/profile');
      } else {
        Alert.alert('Admin data unavailable', error.message || 'Could not load dashboard data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestJson, router, token]);

  useEffect(() => {
    const prepare = async () => {
      const role = await AsyncStorage.getItem('user_role');
      const storedToken = await AsyncStorage.getItem('user_token');

      if (role !== 'admin' || !storedToken) {
        Alert.alert('Admin access required', 'Please sign in with an administrator account.');
        router.replace('/(tabs)/profile');
        return;
      }

      setToken(storedToken);
    };

    prepare();
  }, [router]);

  useEffect(() => {
    if (token) loadData();
  }, [loadData, token]);

  const analytics = useMemo(() => {
    const unread = messages.filter((message) => message.status === 'unread').length;
    const openOrders = orders.filter((order) => ['pending', 'processing', 'shipped'].includes(order.status || '')).length;
    const pendingSellerRequests = sellerRequests.filter((request) => request.status === 'pending').length;
    const lowStock = products.filter((product) => Number(product.stock || 0) <= 3).length;
    const sellers = users.filter((user) => user.role === 'seller').length;
    const banned = users.filter((user) => user.isBanned).length;
    const diseaseScans = scans.filter((scan) => !/healthy|sain|سليم|سليمة/i.test(scan.disease || '')).length;
    const diseaseCounts = scans.reduce<Record<string, number>>((acc, scan) => {
      const name = normalizeDiseaseClass(scan.disease);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, { 'Early Blight': 0, 'Late Blight': 0, Healthy: 0 });

    const diseaseTranslations: Record<string, Record<string, string>> = {
      en: {
        'Early Blight': 'Potato Early Blight',
        'Late Blight': 'Potato Late Blight',
        Healthy: 'Healthy Potato',
      },
      fr: {
        'Early Blight': 'Alternariose de la pomme de terre',
        'Late Blight': 'Mildiou de la pomme de terre',
        Healthy: 'Pomme de terre saine',
      },
      ar: {
        'Early Blight': 'اللفحة المبكرة في البطاطس',
        'Late Blight': 'اللفحة المتأخرة في البطاطس',
        Healthy: 'بطاطس سليمة',
      },
    };

    const lang = i18n.language?.toLowerCase?.() || 'en';
    const diseaseLabels = diseaseTranslations[lang] || diseaseTranslations.en;
    const diseaseData = diseaseKeys.map((key) => ({
      name: diseaseLabels[key] || diseaseTranslations.en[key],
      value: diseaseCounts[key] || 0,
    }));

    return {
      unread,
      openOrders,
      pendingSellerRequests,
      lowStock,
      sellers,
      banned,
      diseaseScans,
      diseaseData,
      avgConfidence: Number(stats.avgConfidence || 0),
    };
  }, [i18n.language, messages, orders, products, scans, sellerRequests, stats, users]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const cycleOrderStatus = async (order: Order) => {
    if (!token || !order._id) return;
    const currentIndex = Math.max(0, statusFlow.indexOf(order.status || 'pending'));
    const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

    try {
      const updated = await requestJson(`/api/admin/orders/${order._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((current) => current.map((item) => (item._id === order._id ? updated : item)));
    } catch (error: any) {
      Alert.alert('Status update failed', error.message || 'Unable to update this order.');
    }
  };

  const toggleUserBan = async (user: User) => {
    try {
      const result = await requestJson(`/api/admin/users/${user._id}/ban`, { method: 'PUT' });
      setUsers((current) => current.map((item) => (item._id === user._id ? { ...item, isBanned: result.isBanned } : item)));
    } catch (error: any) {
      Alert.alert('User update failed', error.message || 'Unable to update this user.');
    }
  };

  const decideSellerRequest = async (request: SellerRequest, decision: 'approve' | 'reject') => {
    try {
      const data = await requestJson(`/api/admin/seller-requests/${request._id}/${decision}`, { method: 'PUT' });
      setSellerRequests((current) => current.map((item) => (item._id === request._id ? data.request : item)));
      if (data.product) setProducts((current) => [data.product, ...current]);
    } catch (error: any) {
      Alert.alert('Request update failed', error.message || 'Unable to update this seller request.');
    }
  };

  const markMessageRead = async (message: Message) => {
    if (message.status !== 'unread') return;
    try {
      const updated = await requestJson(`/api/contact/${message._id}`, { method: 'PATCH' });
      setMessages((current) => current.map((item) => (item._id === message._id ? updated : item)));
    } catch {
      // Keep the inbox usable even if marking read fails.
    }
  };

  const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number }> = [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'orders', label: 'Orders', icon: 'receipt-outline', badge: analytics.openOrders },
    { key: 'requests', label: 'Requests', icon: 'storefront-outline', badge: analytics.pendingSellerRequests },
    { key: 'scans', label: 'Scans', icon: 'scan-outline' },
    { key: 'market', label: 'Market', icon: 'cube-outline', badge: analytics.lowStock },
    { key: 'users', label: 'Users', icon: 'people-outline' },
    { key: 'support', label: 'Support', icon: 'mail-outline', badge: analytics.unread },
  ];

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingShell} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Loading admin console...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Image source={require('../assets/images/agrovision logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Admin Console</Text>
          <Text style={styles.subtitle}>Operational dashboard</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadData(true)}>
          <Ionicons name="refresh" size={20} color="#0F766E" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRail}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRailContent}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FFF' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              {!!tab.badge && <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text></View>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F766E" />}
      >
        {activeTab === 'overview' && (
          <>
            <View style={styles.kpiGrid}>
              <KpiCard icon="cash-multiple" label="Revenue" value={formatMoney(stats.totalRevenue)} helper={`${formatMoney(stats.deliveredRevenue)} delivered`} tone="#0F766E" />
              <KpiCard icon="receipt-text-outline" label="Orders" value={formatNumber(orders.length)} helper={`${analytics.openOrders} open`} tone="#2563EB" />
              <KpiCard icon="leaf-circle-outline" label="Scans" value={formatNumber(scans.length || stats.scansCount)} helper={`${analytics.avgConfidence.toFixed(1)}% avg confidence`} tone="#7C3AED" />
              <KpiCard icon="storefront-outline" label="Pending sales" value={formatNumber(analytics.pendingSellerRequests)} helper="Need admin review" tone="#D97706" />
            </View>

            <SectionTitle title="Disease mix" caption="Top AI diagnoses" />
            <View style={styles.panel}>
              {analytics.diseaseData.length ? analytics.diseaseData.map((item, index) => (
                <ProgressRow key={item.name} label={item.name} value={item.value} max={Math.max(...analytics.diseaseData.map((d) => d.value), 1)} color={['#0F766E', '#2563EB', '#D97706', '#DC2626', '#7C3AED'][index % 5]} />
              )) : <EmptyState label="No scan data yet" />}
            </View>

            <SectionTitle title="Operational health" caption="Users, inventory, support" />
            <View style={styles.metricPanel}>
              <MetricRow label="Sellers" value={formatNumber(analytics.sellers)} />
              <MetricRow label="Seller requests" value={formatNumber(analytics.pendingSellerRequests)} />
              <MetricRow label="Suspended users" value={formatNumber(analytics.banned)} />
              <MetricRow label="Disease scans" value={formatNumber(analytics.diseaseScans)} />
              <MetricRow label="Unread support" value={formatNumber(analytics.unread)} />
            </View>
          </>
        )}

        {activeTab === 'orders' && orders.map((order) => (
          <TouchableOpacity key={order._id} style={styles.listCard} onPress={() => cycleOrderStatus(order)}>
            <View style={styles.listTop}>
              <View>
                <Text style={styles.cardTitle}>{order.user?.fullName || 'Unknown customer'}</Text>
                <Text style={styles.cardSub}>{formatDate(order.createdAt)}</Text>
              </View>
              <StatusPill status={order.status || 'pending'} />
            </View>
            <Text style={styles.orderItems}>{(order.items || []).map((item) => `${item.quantity || 1}x ${item.product?.name || 'Product'}`).join(', ')}</Text>
            <Text style={styles.moneyText}>{formatMoney(order.totalAmount)}</Text>
            <Text style={styles.actionHint}>Tap to move to next status</Text>
          </TouchableOpacity>
        ))}

        {activeTab === 'requests' && sellerRequests.map((request) => (
          <View key={request._id} style={styles.listCard}>
            <View style={styles.listTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>{request.productName || request.productType || 'Product request'}</Text>
                <Text style={styles.cardSub}>{request.companyName || request.user?.fullName || 'Seller'} • {formatDate(request.createdAt)}</Text>
              </View>
              <Text style={[styles.rolePill, request.status === 'approved' && styles.roleSeller, request.status === 'rejected' && styles.roleRejected]}>
                {request.status || 'pending'}
              </Text>
            </View>
            <Text style={styles.messagePreview}>{request.description || 'No description'}</Text>
            <Text style={styles.moneyText}>{request.price || '0 DT'} • Stock {request.stock ?? 0}</Text>
            {request.status === 'pending' ? (
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.approveButton} onPress={() => decideSellerRequest(request, 'approve')}>
                  <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={() => decideSellerRequest(request, 'reject')}>
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.actionHint}>Decision already recorded</Text>
            )}
          </View>
        ))}

        {activeTab === 'scans' && scans.map((scan) => (
          <View key={scan._id} style={styles.listCard}>
            <View style={styles.listTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>{scan.disease || 'Unknown diagnosis'}</Text>
                <Text style={styles.cardSub}>{scan.plantName || 'Plant'} • {scan.user?.fullName || 'Unknown user'}</Text>
              </View>
              <Text style={styles.confidence}>{scan.confidence || 0}%</Text>
            </View>
            <Text style={styles.actionHint}>{formatDate(scan.createdAt)}</Text>
          </View>
        ))}

        {activeTab === 'market' && products.map((product) => (
          <View key={product._id} style={styles.listCard}>
            <View style={styles.listTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>{product.name || 'Product'}</Text>
                <Text style={styles.cardSub}>{product.category || 'Category'} • {product.seller?.fullName || 'AgroVision'}</Text>
              </View>
              <Text style={[styles.stockPill, Number(product.stock || 0) <= 3 && styles.stockLow]}>{product.stock ?? 0}</Text>
            </View>
            <Text style={styles.moneyText}>{product.price || '0 DT'}</Text>
          </View>
        ))}

        {activeTab === 'users' && users.map((item) => (
          <TouchableOpacity key={item._id} style={styles.listCard} onPress={() => item.role !== 'admin' && toggleUserBan(item)}>
            <View style={styles.listTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>{item.fullName || 'User'}</Text>
                <Text style={styles.cardSub}>{item.email || '-'}</Text>
              </View>
              <Text style={[styles.rolePill, item.role === 'admin' && styles.roleAdmin, item.role === 'seller' && styles.roleSeller]}>{item.role || 'user'}</Text>
            </View>
            <Text style={[styles.actionHint, item.isBanned && styles.dangerText]}>{item.isBanned ? 'Suspended • tap to reactivate' : item.role === 'admin' ? 'Protected admin account' : 'Active • tap to suspend'}</Text>
          </TouchableOpacity>
        ))}

        {activeTab === 'support' && messages.map((message) => (
          <TouchableOpacity key={message._id} style={styles.listCard} onPress={() => markMessageRead(message)}>
            <View style={styles.listTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.cardTitle}>{message.subject || 'No subject'}</Text>
                <Text style={styles.cardSub}>{message.name || 'Visitor'} • {message.email || '-'}</Text>
              </View>
              {message.status === 'unread' && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.messagePreview}>{message.message}</Text>
            <Text style={styles.actionHint}>{formatDate(message.createdAt)}</Text>
          </TouchableOpacity>
        ))}

        {((activeTab === 'orders' && orders.length === 0)
          || (activeTab === 'scans' && scans.length === 0)
          || (activeTab === 'requests' && sellerRequests.length === 0)
          || (activeTab === 'market' && products.length === 0)
          || (activeTab === 'users' && users.length === 0)
          || (activeTab === 'support' && messages.length === 0)) && <EmptyState label="No records found" />}

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ icon, label, value, helper, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; helper: string; tone: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: `${tone}18` }]}>
        <MaterialCommunityIcons name={icon} size={22} color={tone} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiHelper}>{helper}</Text>
    </View>
  );
}

function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

function ProgressRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === 'delivered' ? '#0F766E' : status === 'cancelled' ? '#DC2626' : status === 'shipped' ? '#0891B2' : status === 'processing' ? '#2563EB' : '#D97706';
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
      <Text style={[styles.statusText, { color }]}>{statusLabels[status] || status}</Text>
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="file-tray-outline" size={26} color="#94A3B8" />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingShell: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  refreshButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  logoBox: { width: 42, height: 42, borderRadius: 12, marginLeft: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  logo: { width: 36, height: 36 },
  headerText: { flex: 1, paddingHorizontal: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', fontWeight: '700', marginTop: 2 },
  tabRail: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabRailContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  tabChipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  tabText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#FFF' },
  badge: { minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  content: { flex: 1, padding: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiLabel: { color: '#64748B', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  kpiValue: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 4 },
  kpiHelper: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 4 },
  sectionTitle: { marginTop: 24, marginBottom: 10 },
  sectionHeading: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sectionCaption: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 2 },
  panel: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  metricPanel: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  progressRow: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  progressLabel: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '800' },
  progressValue: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  metricLabel: { color: '#475569', fontSize: 14, fontWeight: '800' },
  metricValue: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  listCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  listTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  flexShrink: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  cardSub: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 3 },
  orderItems: { color: '#475569', fontSize: 12, fontWeight: '700', marginTop: 12 },
  moneyText: { color: '#0F766E', fontSize: 17, fontWeight: '900', marginTop: 10 },
  actionHint: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginTop: 10 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: '900' },
  confidence: { color: '#0F766E', fontSize: 14, fontWeight: '900', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  stockPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#F1F5F9', color: '#334155', fontSize: 12, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 6 },
  stockLow: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  rolePill: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#F1F5F9', color: '#334155', fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 6, textTransform: 'uppercase' },
  roleAdmin: { backgroundColor: '#F5F3FF', color: '#7C3AED' },
  roleSeller: { backgroundColor: '#ECFDF5', color: '#0F766E' },
  roleRejected: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveButton: { flex: 1, borderRadius: 12, backgroundColor: '#0F766E', paddingVertical: 12, alignItems: 'center' },
  approveText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  rejectButton: { flex: 1, borderRadius: 12, backgroundColor: '#FEF2F2', paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  rejectText: { color: '#DC2626', fontSize: 13, fontWeight: '900' },
  dangerText: { color: '#DC2626' },
  unreadDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#0F766E' },
  messagePreview: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 12 },
  emptyState: { minHeight: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 12 },
  emptyText: { color: '#94A3B8', fontSize: 13, fontWeight: '800', marginTop: 8 },
});
