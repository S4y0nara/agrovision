require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("No API Key found");
        return;
    }
    
    // Test with a known model name that is standard
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        console.log("-> Testing simple prompt...");
        const result = await model.generateContent("Hi");
        const response = await result.response;
        console.log("✅ Success:", response.text());
    } catch (error) {
        console.error("❌ Failed:", error.message);
    }
}

listModels();
