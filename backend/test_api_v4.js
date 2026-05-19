require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function checkModels() {
    const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("No API Key found");
        return;
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("-> Listing models...");
        // Use a generic fetch if listModels isn't directly on genAI in this version
        // Actually, the SDK version 0.24.1 should have listModels?
        // Let's try a different approach: check the supported model names.
        
        const testModels = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.0-pro", "gemini-1.5-pro"];
        
        for (const modelName of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hi");
                const response = await result.response;
                console.log(`✅ ${modelName} works! Response: ${response.text()}`);
                return; // Stop at first working model
            } catch (e) {
                console.log(`❌ ${modelName} failed: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("General Error:", error.message);
    }
}

checkModels();
