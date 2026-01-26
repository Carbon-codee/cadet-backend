require('dotenv').config();
const OpenAI = require("openai");

async function simpleTest() {
    console.log("Simple API Test...");
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error("No API KEY");
            return;
        }
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: "Say hello" }],
            model: "gpt-4o-mini",
        });
        console.log("Response:", completion.choices[0].message.content);
        console.log("✅ API Connection Success");
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}
simpleTest();
