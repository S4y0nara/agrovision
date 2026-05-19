const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/authMiddleware');

// Get all users (Admin only)
router.get('/all', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update cart
router.post('/cart', async (req, res) => {
    try {
        const { userId, cart } = req.body; // cart should be [{ product: id, quantity: n }]
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.cart = cart;
        await user.save();
        res.json({ message: 'Cart updated', cart: user.cart });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update favorites
router.post('/favorites', async (req, res) => {
    try {
        const { userId, favorites } = req.body; // favorites should be [id]
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.favorites = favorites;
        await user.save();
        res.json({ message: 'Favorites updated', favorites: user.favorites });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/orders', authMiddleware, async (req, res) => {
    try {
        const { items, totalAmount, paymentMethod, cardLast4, shippingAddress } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty.' });
        }
        if (!cardLast4 || String(cardLast4).length !== 4) {
            return res.status(400).json({ message: 'Card payment is required before placing the order.' });
        }

        const order = await Order.create({
            user: req.user._id,
            items: items.map(item => ({
                product: item.product,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount,
            paymentMethod: paymentMethod || `Card ending ${cardLast4}`,
            shippingAddress: shippingAddress || ''
        });

        req.user.cart = [];
        await req.user.save();

        res.status(201).json({ message: 'Payment accepted and order created.', order });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get user data (cart and favorites)
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('cart.product')
            .populate('favorites');

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({
            cart: user.cart,
            favorites: user.favorites
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get user profile statistics (scans, bought, sold and timeline)
router.get('/:userId/stats', async (req, res) => {
    try {
        const userId = req.params.userId;
        const Scan = require('../models/Scan');
        const Order = require('../models/Order');

        // 1. Total Scans
        const scanCount = await Scan.countDocuments({ user: userId });

        // 2. Bought Items (orders where user is the buyer)
        const buyOrders = await Order.find({ user: userId }).populate('items.product').sort({ createdAt: -1 });
        let boughtCount = 0;
        buyOrders.forEach(order => {
            order.items.forEach(item => {
                boughtCount += item.quantity;
            });
        });

        // 3. Sold Items (orders containing products where seller === userId)
        const allOrders = await Order.find().populate('items.product').sort({ createdAt: -1 });
        let soldCount = 0;
        const sellOrders = [];
        
        allOrders.forEach(order => {
            let hasMyProduct = false;
            let myIncome = 0;
            order.items.forEach(item => {
                if (item.product && String(item.product.seller) === String(userId)) {
                    soldCount += item.quantity;
                    hasMyProduct = true;
                    myIncome += item.quantity * parseFloat(item.price);
                }
            });
            
            if (hasMyProduct) {
                // Formatting this for the timeline
                sellOrders.push({
                    _id: order._id,
                    type: 'sell',
                    total: myIncome,
                    createdAt: order.createdAt,
                    items: order.items.filter(i => i.product && String(i.product.seller) === String(userId))
                });
            }
        });

        res.json({
            stats: {
                scans: scanCount,
                bought: boughtCount,
                sold: soldCount
            },
            history: {
                buyOrders,
                sellOrders
            }
        });

    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ message: err.message });
    }
});


// Update user profile (phone, location)
router.put('/update', async (req, res) => {
    try {
        const { userId, phone, location } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (phone) user.phone = phone;
        if (location) user.location = location;

        await user.save();
        res.json({ message: 'Profile updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
