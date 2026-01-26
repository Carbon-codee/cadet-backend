require('dotenv').config();
const aiService = require('./utils/aiService');

async function testAI() {
    console.log("Testing OpenAI Integration...");

    try {
        console.log("\n--- Testing Daily Content Generation ---");
        const dailyContent = await aiService.generateDailyContent("Denizcilikte Haberleşme", false);
        console.log("Daily Content Result:", JSON.stringify(dailyContent, null, 2).substring(0, 200) + "...");
        if (dailyContent.questions && dailyContent.questions.length > 0) {
            console.log("✅ Daily Content Generation Successful");
        } else {
            console.error("❌ Daily Content Generation Failed (No questions)");
        }
    } catch (e) {
        console.error("❌ Daily Content Error:", e.message);
    }

    try {
        console.log("\n--- Testing Chat ---");
        const chatResponse = await aiService.chatWithAi("Merhaba, sen kimsin?");
        console.log("Chat Response:", chatResponse);
        if (chatResponse && chatResponse.length > 0 && !chatResponse.includes("HATA")) {
            console.log("✅ Chat Successful");
        } else {
            console.error("❌ Chat Failed");
        }
    } catch (e) {
        console.error("❌ Chat Error:", e.message);
    }
}

testAI();
