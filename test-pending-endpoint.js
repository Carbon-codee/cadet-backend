const axios = require('axios');
const mongoose = require('mongoose');

const API_URL = 'http://localhost:5000/api';
const adminEmail = "admin@marinecadet.com";
const password = "Admin123!";

async function testPendingEndpoint() {
    try {
        // 1. Admin Login
        console.log("Admin girişi yapılıyor...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: adminEmail,
            password: password
        });
        const token = loginRes.data.token;
        console.log("Login başarılı. Token alındı.");

        // 2. Pending Users İsteği
        console.log("Pending Users endpoint'ine istek atılıyor...");
        const res = await axios.get(`${API_URL}/admin/pending-users`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("\n--- API YANITI ---");
        console.log(`Durum Kodu: ${res.status}`);
        console.log(`Dönen Kayıt Sayısı: ${res.data.length}`);
        console.log(JSON.stringify(res.data, null, 2));

    } catch (error) {
        console.error("HATA:", error.response ? error.response.data : error.message);
    }
}

testPendingEndpoint();
