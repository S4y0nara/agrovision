const axios = require('axios');

async function testChat() {
    try {
        console.log("-> Testing Chat API...");
        const response = await axios.post('http://localhost:5001/api/chat', {
            message: "Hello AgroBot, give me a quick tip for growing tomatoes."
        });
        console.log("✅ Success! AgroBot says:");
        console.log(response.data.reply);
    } catch (error) {
        console.error("❌ Test Failed:");
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testChat();
