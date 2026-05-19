const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const adminMiddleware = require('../middleware/adminMiddleware');

// POST /api/contact — public, any visitor can submit
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email and message are required.' });
        }
        const contact = new Contact({ name, email, subject: subject || '', message });
        await contact.save();
        res.status(201).json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
        console.error('Contact POST error:', err);
        res.status(500).json({ error: 'Failed to save message.' });
    }
});

// GET /api/contact — admin only
router.get('/', adminMiddleware, async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/contact/:id — mark as read (admin only)
router.patch('/:id', adminMiddleware, async (req, res) => {
    try {
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { status: 'read' },
            { new: true }
        );
        if (!contact) return res.status(404).json({ error: 'Message not found.' });
        res.json(contact);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/contact/:id — admin only
router.delete('/:id', adminMiddleware, async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
