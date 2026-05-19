const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Scan = require('../models/Scan');
const SellerRequest = require('../models/SellerRequest');
const adminMiddleware = require('../middleware/adminMiddleware');
const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
const DISEASE_CLASSES = ['Early Blight', 'Late Blight', 'Healthy'];

const normalizeDiseaseClass = (value) => {
    const text = String(value || '').toLowerCase();
    if (text.includes('healthy') || text.includes('sain') || text.includes('saine') || text.includes('صحي') || text.includes('سليم')) return 'Healthy';
    if (text.includes('late') || text.includes('tardif') || text.includes('mildiou') || text.includes('متأخر')) return 'Late Blight';
    if (text.includes('early') || text.includes('précoce') || text.includes('precoce') || text.includes('alternariose') || text.includes('مبكر')) return 'Early Blight';
    return 'Early Blight';
};

const formatPrice = (price) => {
    const raw = String(price || '').trim();
    if (!raw) return '';
    return /dt$/i.test(raw) ? raw : `${raw} DT`;
};

// Apply admin protection to all routes in this file
router.use(adminMiddleware);

// Get dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
    try {
        const usersCount = await User.countDocuments();
        const sellersCount = await User.countDocuments({ role: 'seller' });
        const bannedUsersCount = await User.countDocuments({ isBanned: true });
        const productsCount = await Product.countDocuments();
        const pendingSellerRequestsCount = await SellerRequest.countDocuments({ status: 'pending' });
        const scansCount = await Scan.countDocuments();
        const ordersCount = await Order.countDocuments();
        const openOrdersCount = await Order.countDocuments({ status: { $in: ['pending', 'processing', 'shipped'] } });
        
        const orders = await Order.find();
        const totalRevenue = orders.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
        const deliveredRevenue = orders
            .filter(order => order.status === 'delivered')
            .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        const diseaseCounts = Object.fromEntries(DISEASE_CLASSES.map(name => [name, 0]));
        const scanDiseases = await Scan.find().select('disease');
        scanDiseases.forEach(scan => {
            const className = normalizeDiseaseClass(scan.disease);
            diseaseCounts[className] = (diseaseCounts[className] || 0) + 1;
        });

        const diseaseData = DISEASE_CLASSES.map(name => ({
            name,
            value: diseaseCounts[name] || 0
        }));

        // Calculate average confidence
        const avgConfidence = await Scan.aggregate([
            { $group: { _id: null, avg: { $avg: '$confidence' } } }
        ]);

        const scanTrend = await Scan.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    scans: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
            { $sort: { _id: 1 } }
        ]);

        const orderStatusData = await Order.aggregate([
            { $group: { _id: '$status', value: { $sum: 1 } } },
            { $sort: { value: -1 } }
        ]);

        const revenueTrend = await Order.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
            { $sort: { _id: 1 } }
        ]);

        // Recent activity (e.g., last 5 scans)
        const recentScans = await Scan.find()
            .populate('user', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            usersCount,
            sellersCount,
            bannedUsersCount,
            productsCount,
            pendingSellerRequestsCount,
            scansCount,
            ordersCount,
            openOrdersCount,
            totalRevenue,
            deliveredRevenue,
            diseaseData,
            scanTrend: scanTrend.map(item => ({
                date: item._id,
                scans: item.scans,
                avgConfidence: Number((item.avgConfidence || 0).toFixed(2))
            })),
            orderStatusData: orderStatusData.map(item => ({ name: item._id || 'unknown', value: item.value })),
            revenueTrend: revenueTrend.map(item => ({ date: item._id, revenue: item.revenue, orders: item.orders })),
            recentScans,
            avgConfidence: avgConfidence.length > 0 ? avgConfidence[0].avg.toFixed(2) : 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get seller product requests pending admin review
router.get('/seller-requests', async (req, res) => {
    try {
        const requests = await SellerRequest.find()
            .populate('user', 'fullName email role phone')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Approve seller product request and publish product
router.put('/seller-requests/:id/approve', async (req, res) => {
    try {
        const request = await SellerRequest.findById(req.params.id).populate('user', 'fullName email role');
        if (!request) return res.status(404).json({ message: 'Seller request not found' });
        if (request.status === 'approved') return res.status(400).json({ message: 'Request is already approved' });

        const product = new Product({
            name: request.productName || `${request.productType} by ${request.companyName}`,
            category: request.productType,
            price: formatPrice(request.price),
            image: request.productImage?.startsWith('http') ? request.productImage : `${BACKEND_URL}${request.productImage}`,
            tag: 'Seller',
            desc: request.description || '',
            stock: Number(request.stock || 1),
            isOffer: false,
            seller: request.user?._id || request.user
        });

        await product.save();

        if (request.user) {
            await User.findByIdAndUpdate(request.user._id || request.user, { role: 'seller' });
        }

        request.status = 'approved';
        await request.save();
        await request.populate('user', 'fullName email role phone');

        res.json({ message: 'Seller request approved and product published', request, product });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Reject seller product request
router.put('/seller-requests/:id/reject', async (req, res) => {
    try {
        const request = await SellerRequest.findById(req.params.id).populate('user', 'fullName email role phone');
        if (!request) return res.status(404).json({ message: 'Seller request not found' });

        request.status = 'rejected';
        await request.save();

        res.json({ message: 'Seller request rejected', request });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all users (Admin only)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -verificationCode -passwordResetToken')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all products (Admin only)
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find()
            .populate('seller', 'fullName email role')
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const { status } = req.body;
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('user', 'fullName email').populate('items.product');

        if (!order) return res.status(404).json({ message: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all orders (Admin only)
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'fullName email')
            .populate('items.product')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Ban or Unban a user
router.put('/users/:id/ban', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        // Cannot ban another admin
        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Cannot ban an administrator' });
        }

        user.isBanned = !user.isBanned;
        await user.save();
        res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'} successfully`, isBanned: user.isBanned });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete an administrator' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a product
router.delete('/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all scans
router.get('/scans', async (req, res) => {
    try {
        const scans = await Scan.find()
            .populate('user', 'fullName email')
            .sort({ createdAt: -1 });
        res.json(scans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
