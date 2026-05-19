const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini optionally
const { GoogleGenerativeAI } = require('@google/generative-ai');
let ai;
const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;
if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

router.post('/', upload.single('file'), async (req, res) => {
    console.log('[diseaseRoute] POST /api/disease called');
    console.log('[diseaseRoute] req.file:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'MISSING');
    console.log('[diseaseRoute] req.body:', req.body);

    try {
        if (!req.file) {
            console.error('[diseaseRoute] No file received!');
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname || 'plant.jpg');

        const targetUrl = process.env.POTATO_API_URL || 'http://localhost:8001/predict';
        console.log('[diseaseRoute] Forwarding to FastAPI:', targetUrl);

        const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData
        });

        console.log('[diseaseRoute] FastAPI response status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error('[diseaseRoute] FastAPI error:', errText);
            throw new Error(`FastAPI returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log('[diseaseRoute] FastAPI result:', data);
        
        let translatedDisease = data.class;
        let recommendations = [];
        let treatment = '';

        // language comes from FormData text fields – Multer puts these in req.body
        const requestedLanguage = (req.body && req.body.language) ? req.body.language : 'fr';
        console.log('[diseaseRoute] Language:', requestedLanguage);
        
        if (ai) {
            try {
                let langInstruction = 'French';
                if (requestedLanguage === 'ar') langInstruction = 'Arabic';
                if (requestedLanguage === 'en') langInstruction = 'English';

                console.log('[diseaseRoute] Calling Gemini for translation in', langInstruction);

                const prompt = `The AI disease detection model is potato-only. It can return only "Early Blight", "Late Blight", or "Healthy" for potato leaves.
It identified "${data.class}" with a confidence of ${data.confidence}.
Language: ${langInstruction}

Please provide:
1. The translated potato-specific name of "${data.class}" in ${langInstruction}. Do not mention tomato or any non-potato crop.
2. A short treatment paragraph in ${langInstruction}.
3. 3-4 specific recommendations as an array of strings in ${langInstruction}.

Provide the result as a raw JSON object (no markdown, no code fences):
{
  "translatedDisease": "string",
  "treatment": "string",
  "recommendations": ["string", "string"]
}`;

                const aiRes = await ai.generateContent(prompt);
                const aiResponse = await aiRes.response;
                let text = aiResponse.text().trim();
                // Strip markdown code fences robustly (handles ```json\n...\n``` with newlines)
                text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

                console.log('[diseaseRoute] Gemini raw output:', text.substring(0, 300));

                const parsed = JSON.parse(text);
                translatedDisease = parsed.translatedDisease || data.class;
                treatment = parsed.treatment || '';
                recommendations = parsed.recommendations || [];
                console.log('[diseaseRoute] Translation done:', translatedDisease);

                // If Gemini returned empty recommendations, generate built-in ones per language
                if (recommendations.length === 0) {
                    const builtIn = {
                        ar: [
                            'إزالة الأوراق المصابة',
                            'تطبيق مبيد فطري مناسب',
                            'ضمان تهوية جيدة للنبات',
                            'تجنب الري من الأعلى'
                        ],
                        fr: [
                            'Retirer les feuilles affectées',
                            'Appliquer un fongicide approprié',
                            'Assurer une bonne circulation d\'air',
                            'Éviter l\'arrosage par aspersion'
                        ],
                        en: [
                            'Remove affected leaves',
                            'Apply appropriate fungicide',
                            'Ensure good air circulation',
                            'Avoid overhead watering'
                        ]
                    };
                    recommendations = builtIn[requestedLanguage] || builtIn.en;
                }
            } catch (err) {
                console.error('[diseaseRoute] Gemini translation error:', err.message);
                // Gemini failed — use language-aware built-in recommendations
                const builtInFallback = {
                    ar: ['إزالة الأوراق المصابة', 'تطبيق مبيد فطري مناسب', 'ضمان تهوية جيدة للنبات', 'تجنب الري من الأعلى'],
                    fr: ['Retirer les feuilles affectées', 'Appliquer un fongicide approprié', 'Assurer une bonne circulation d\'air', 'Éviter l\'arrosage par aspersion'],
                    en: ['Remove affected leaves', 'Apply appropriate fungicide', 'Ensure good air circulation', 'Avoid overhead watering']
                };
                recommendations = builtInFallback[requestedLanguage] || builtInFallback.en;
            }
        } else {
            console.warn('[diseaseRoute] Gemini AI not initialized — using built-in recommendations');
            const builtInNoAI = {
                ar: ['إزالة الأوراق المصابة', 'تطبيق مبيد فطري مناسب', 'ضمان تهوية جيدة للنبات', 'تجنب الري من الأعلى'],
                fr: ['Retirer les feuilles affectées', 'Appliquer un fongicide approprié', 'Assurer une bonne circulation d\'air', 'Éviter l\'arrosage par aspersion'],
                en: ['Remove affected leaves', 'Apply appropriate fungicide', 'Ensure good air circulation', 'Avoid overhead watering']
            };
            recommendations = builtInNoAI[requestedLanguage] || builtInNoAI.en;
        }

        res.json({
            class: translatedDisease,
            originalClass: data.class,
            confidence: data.confidence,
            treatment: treatment,
            recommendations: recommendations
        });
    } catch (error) {
        console.error('[diseaseRoute] Fatal error:', error.message);
        res.status(500).json({ error: 'Failed to analyze image', details: error.message });
    }
});

module.exports = router;
