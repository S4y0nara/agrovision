const express = require('express');
const router = express.Router();
const SellerRequest = require('../models/SellerRequest');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const User = require('../models/User');
const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const publicUser = (user) => ({
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    profilePic: user.profilePic || '',
    isEmailVerified: user.isEmailVerified
});

const formatPrice = (price) => {
    const raw = String(price || '').trim();
    if (!raw) return '';
    return /dt$/i.test(raw) ? raw : `${raw} DT`;
};

// Let any authenticated customer become a seller immediately.
router.post('/become-seller', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'seller' && req.user.role !== 'admin') {
            req.user.role = 'seller';
            await req.user.save();
        }

        res.json({ message: 'Seller account activated.', user: publicUser(req.user) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Seller listing request: products stay pending until an admin approves them.
router.post('/products', authMiddleware, upload.single('productImage'), async (req, res) => {
    try {
        const { name, category, price, description, stock } = req.body;
        const productImage = req.file ? `/uploads/${req.file.filename}` : '';

        if (!name || !category || !price || !description || !productImage) {
            return res.status(400).json({ message: 'Name, category, price, description and product image are required.' });
        }

        const request = new SellerRequest({
            user: req.user._id,
            companyName: req.user.fullName || 'Seller',
            phone: req.user.phone || 'Not provided',
            productName: name,
            productType: category,
            description,
            price: formatPrice(price),
            stock: Number(stock || 1),
            productImage,
            status: 'pending'
        });

        await request.save();

        res.status(201).json({
            message: 'Product submitted for admin approval.',
            request,
            user: publicUser(req.user)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Submit seller request with product image
router.post('/request', authMiddleware, upload.single('productImage'), async (req, res) => {
    try {
        const { companyName, phone, productName, productType, description, price, stock } = req.body;
        const productImage = req.file ? `/uploads/${req.file.filename}` : '';

        const request = new SellerRequest({
            user: req.user._id,
            companyName: companyName || req.user.fullName || 'Seller',
            phone: phone || req.user.phone || 'Not provided',
            productName,
            productType,
            description,
            price: formatPrice(price),
            stock,
            productImage
        });

        await request.save();
        res.status(201).json({ message: 'Request submitted successfully', request });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all requests (legacy admin use case; protected in adminRoutes for the panel)
router.get('/requests', async (req, res) => {
    try {
        const requests = await SellerRequest.find().populate('user', 'fullName email');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/approve/:id', async (req, res) => {
    try {
        const request = await SellerRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Create new product from request
        const newProduct = new Product({
            name: request.productName || `${request.productType} by ${request.companyName}`,
            category: request.productType,
            price: formatPrice(request.price),
            image: `${BACKEND_URL}${request.productImage}`,
            tag: "Seller",
            desc: request.description,
            stock: request.stock,
            isOffer: false,
            seller: request.user
        });

        await newProduct.save();

        if (request.user) {
            await User.findByIdAndUpdate(request.user, { role: 'seller' });
        }

        // Mark request as approved
        request.status = 'approved';
        await request.save();

        res.json({ message: 'Request approved and product created', product: newProduct });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Reject seller request
router.post('/reject/:id', async (req, res) => {
    try {
        const request = await SellerRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        request.status = 'rejected';
        await request.save();

        res.json({ message: 'Request rejected' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
