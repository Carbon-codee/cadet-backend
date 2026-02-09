const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
let token = '';

async function testKVKK() {
    try {
        // DB Bağlantısı (Mail onayı bypass için)
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log("✅ DB Bağlantısı başarılı (Onay bypass için).");
        }
        const User = require('./models/User');

        const randomEmail = `testuser${Math.floor(Math.random() * 10000)}@itu.edu.tr`;
        const testPassword = 'Password123!';

        console.log(`\n0. Yeni Kullanıcı Oluşturuluyor (${randomEmail})...`);
        try {
            await axios.post(`${API_URL}/auth/register`, {
                name: 'Test',
                email: randomEmail,
                password: testPassword,
                role: 'student',
                department: 'Güverte',
                classYear: '3. Sınıf'
            });
            console.log("✅ Kayıt Başarılı. DB'den onaylanıyor...");

            // Mail onayını bypass et
            await User.findOneAndUpdate({ email: randomEmail }, { isVerified: true });
            console.log("✅ Kullanıcı DB'den doğrulandı (isVerified: true).");

        } catch (e) {
            console.log("⚠️ Kayıt/DB Hatası:", e.message);
        }

        console.log("\n1. Login Olunuyor...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: randomEmail,
            password: testPassword
        });

        token = loginRes.data.token;
        console.log(`✅ Login Başarılı.`);
        console.log(`   Mevcut KVKK Durumu: ${loginRes.data.kvkkApproved}`);

        // 2. KVKK Onayla
        console.log("\n2. KVKK Onaylanıyor...");
        const approveRes = await axios.post(
            `${API_URL}/users/approve-kvkk`,
            { version: "1.0.1" },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`✅ Onay Yanıtı:`, approveRes.data);

        // 3. Profili Tekrar Çekip Kontrol Et
        console.log("\n3. Profil Tekrar Kontrol Ediliyor...");
        const profileRes = await axios.get(
            `${API_URL}/auth/profile/me`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (profileRes.data.kvkkApproved === true) {
            console.log(`✅ TEST BAŞARILI: Kullanıcı artık onaylı görünüyor.`);
            console.log(`   Onay Tarihi: ${profileRes.data.kvkkApprovalDate}`);
            console.log(`   Versiyon: ${profileRes.data.kvkkVersion}`);
            console.log(`   IP: ${profileRes.data.kvkkIpAddress}`);
        } else {
            console.error(`❌ TEST BAŞARISIZ: Kullanıcı hala onaysız görünüyor.`);
        }

    } catch (error) {
        if (error.response) {
            console.error("❌ API Hatası:", error.response.status, error.response.data);
        } else {
            console.error("❌ Hata:", error.message);
        }
    } finally {
        // DB bağlantısını kapat
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

testKVKK();
