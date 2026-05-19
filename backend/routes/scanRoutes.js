const express = require('express');
const router = express.Router();
const Scan = require('../models/Scan');
const { GoogleGenAI } = require('@google/genai');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Initialize Gemini optionally (in case key is missing it won't crash on boot)
let ai;
const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

// POST a new scan result
router.post('/', async (req, res) => {
    try {
        const { userId, plantName, disease, confidence, imageUrl, treatment: providedTreatment } = req.body;

        if (!userId || !plantName || !disease) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        let treatment = providedTreatment || '';

        if (disease.toLowerCase() === 'healthy') {
            treatment = 'The plant is healthy! Continue with regular maintenance, appropriate watering, and ensure it receives adequate sunlight. No specific treatments are required at this time.';
        } else if (ai && !treatment) {
            try {
                const prompt = `You are an expert agricultural AI. A farmer has scanned a ${plantName} plant. The AI disease detection model identified "${disease}" with a confidence of ${confidence}%.
Please provide specific treatment recommendations for this disease. 
Include:
1. Specific fungicide/treatment names if applicable.
2. Treatment schedule.
3. Urgency warning and maintenance tips.
Please put the response in a short, concise, structured and professional format. Ensure it's very practical for farmers.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-1.5-flash',
                    contents: prompt,
                    config: {
                        systemInstruction: 'You are an agricultural expert providing advice to farmers. Be concise, actionable, and structured.'
                    }
                });

                treatment = response.text || 'No treatment advice was generated.';
            } catch (aiErr) {
                console.error('Error fetching Gemini treatment:', aiErr);
                treatment = 'Treatment advice is currently unavailable due to an AI service error. Please consult a local agricultural expert.';
            }
        } else {
            console.warn('Gemini_API_Key is not set. Using fallback treatment messages.');
            treatment = 'Treatment advice is currently unavailable because the AI service is not configured on the server. Please consult an expert.';
        }

        const newScan = new Scan({
            user: userId,
            plantName,
            disease,
            confidence,
            imageUrl,
            treatment
        });

        const savedScan = await newScan.save();
        res.status(201).json(savedScan);

    } catch (err) {
        console.error('Scan creation error:', err);
        res.status(500).json({ message: 'Failed to save scan', error: err.message });
    }
});

// GET all scans for a specific user
router.get('/:userId', async (req, res) => {
    try {
        const scans = await Scan.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(scans);
    } catch (err) {
        console.error('Get scans error:', err);
        res.status(500).json({ message: 'Failed to fetch scans', error: err.message });
    }
});

module.exports = router;
