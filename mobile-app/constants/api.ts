// Configuration de l'API locale.
// IMPORTANT: Si vous testez sur un appareil physique, assurez-vous que votre PC et votre téléphone
// sont sur le même réseau WiFi, et remplacez cette adresse IP par celle de votre ordinateur (IPv4).

export const API_URL = 'http://192.168.1.12:5001';

// Helpers pour les endpoints majeurs
export const ENDPOINTS = {
    auth: {
        login: `${API_URL}/api/auth/login`,
        register: `${API_URL}/api/auth/register`,
        verifyEmail: `${API_URL}/api/auth/verify-email`,
        resendVerification: `${API_URL}/api/auth/resend-verification`,
        forgotPassword: `${API_URL}/api/auth/forgot-password`,
    },
    chat: {
        base: `${API_URL}/api/chat`,
        history: `${API_URL}/api/chat/history`,
    },
    marketplace: {
        products: `${API_URL}/api/products`,
        add_product: `${API_URL}/api/seller/products`,
        become_seller: `${API_URL}/api/seller/become-seller`,
    },
    disease: {
        detect: `${API_URL}/api/disease`,
    },
    admin: {
        stats: `${API_URL}/api/admin/dashboard-stats`,
        orders: `${API_URL}/api/admin/orders`,
        users: `${API_URL}/api/admin/users`,
        products: `${API_URL}/api/admin/products`,
        sellerRequests: `${API_URL}/api/admin/seller-requests`,
        scans: `${API_URL}/api/admin/scans`,
        messages: `${API_URL}/api/contact`,
    }
};
