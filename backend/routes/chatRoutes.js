const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Groq = require('groq-sdk');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Initialize Groq
let groq;
const apiKey = process.env.GROQ_API_KEY;

if (apiKey) {
    groq = new Groq({ apiKey });
} else {
    console.warn('⚠️ GROQ_API_KEY is missing. Chat features will be disabled.');
}

const SYSTEM_INSTRUCTION = `You are AgroBot, a world-class AI agricultural consultant. Your mission is to provide expert-level, actionable, and scientific advice to farmers and agricultural enthusiasts.

Formatting & Style:
1. Tone: Highly professional, encouraging, and authoritative yet accessible.
2. Structure: Use clear sections with bold titles. Use bullet points for readability.
3. Emojis: Use relevant agricultural and indicator emojis to make the content engaging (e.g., 🌱, 🌾, 🚜, 💧, 📈, ⚠️, ✅, 🥔, 🍎, 🥦).
4. Content: Always provide specific varieties, technical measurements, or scientific reasoning when possible.
5. Scope: Answer ALL agriculture questions including crops, soil, climate, livestock, and tech.

Example response style:
"🌱 **Conseil de Culture**
Pour les sols sablonneux, je recommande la plantation de **Légumes-racines** comme les carottes. 🥕

💧 **Stratégie d'Irrigation**
Puisque le sol sablonneux draine rapidement, utilisez un système de **Goutte-à-goutte**... ✅"
`;


// GET History
router.get('/history', async (req, res) => {
    try {
        const history = await Conversation.find({
            $or: [{ user: req.user._id }, { user: { $exists: false } }]
        }).sort({ updatedAt: -1 }).select('title updatedAt');
        res.json(history);
    } catch (error) {
        console.error("History Error:", error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// DELETE all conversation history for the current user
router.delete('/history/all', async (req, res) => {
    try {
        const result = await Conversation.deleteMany({
            $or: [{ user: req.user._id }, { user: { $exists: false } }]
        });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error("Clear history error:", error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// GET Conversation
router.get('/:id', async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            $or: [{ user: req.user._id }, { user: { $exists: false } }]
        });
        if (!conversation) return res.status(404).json({ error: 'Not found' });
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// DELETE Conversation
router.delete('/:id', async (req, res) => {
    console.log(`-> Deleting conversation: ${req.params.id}`);
    try {
        await Conversation.findOneAndDelete({
            _id: req.params.id,
            $or: [{ user: req.user._id }, { user: { $exists: false } }]
        });
        console.log(`✅ Deleted successfully: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error(`❌ Delete failed for ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed' });
    }
});

// POST Message (GROQ AI FLOW)
router.post('/', async (req, res) => {
    console.log("-> Incoming request to /api/chat");
    const { message, conversationId } = req.body;

    if (!message) return res.status(400).json({ error: 'No message' });

    try {
        let conversation;
        let chatHistory = [];

        const isDbConnected = mongoose.connection.readyState === 1;

        if (isDbConnected && conversationId) {
            conversation = await Conversation.findById(conversationId);
            if (!conversation) return res.status(404).json({ error: 'Chat not found' });
            if (conversation.user && String(conversation.user) !== String(req.user._id)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            if (!conversation.user) conversation.user = req.user._id;

            // Map stored messages to Groq's OpenAI-compatible format
            chatHistory = conversation.messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content
                }));
        } else if (isDbConnected) {
            conversation = new Conversation({
                user: req.user._id,
                title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
                messages: []
            });
        }

        if (isDbConnected) {
            conversation.messages.push({ role: 'user', content: message });
        }

        // Language detection
        const userLanguage = req.body.language || 'fr'; // default to French if not provided
        let languagePrompt = '';
        if (userLanguage === 'fr') {
            languagePrompt = "You are AgroBot, an agricultural assistant. Always respond in French.";
        } else if (userLanguage === 'ar') {
            languagePrompt = "You are AgroBot, an agricultural assistant. Always respond in Arabic.";
        } else if (userLanguage === 'en') {
            languagePrompt = "You are AgroBot, an agricultural assistant. Always respond in English.";
        } else {
            languagePrompt = "You are AgroBot, an agricultural assistant. Always respond in French.";
        }

        const DYNAMIC_INSTRUCTION = `${SYSTEM_INSTRUCTION}\n${languagePrompt}`;

        // Build Groq messages array: system prompt first, then history, then current message
        const groqMessages = [
            { role: 'system', content: DYNAMIC_INSTRUCTION },
            ...chatHistory,
            { role: 'user', content: message }
        ];

        if (!groq) {
            throw new Error("GROQ_API_KEY_MISSING");
        }

        console.log(`-> Calling Groq AI... (Responding in ${userLanguage})`);
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages
        });

        const aiReply = response.choices[0].message.content;
        console.log("-> Groq responded successfully.");

        if (isDbConnected) {
            conversation.messages.push({ role: 'assistant', content: aiReply });
            await conversation.save();
        }

        res.json({
            reply: aiReply,
            conversationId: isDbConnected ? conversation._id : 'offline-session',
            conversationTitle: isDbConnected ? conversation.title : 'Offline Chat'
        });

    } catch (error) {
        console.error("!!! GROQ API ERROR:", error.message);
        res.status(500).json({
            error: "Service indisponible",
            message: "L'IA AgroBot ne répond pas pour le moment. Vérifiez votre clé API ou connexion."
        });
    }
});

module.exports = router;
