const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
let studentToken = '';
let adminToken = '';
let studentId = '';

async function testAdmin() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log("✅ DB Bağlantısı başarılı.");
        }
        const User = require('./models/User');

        const randomEmail = `student${Math.floor(Math.random() * 10000)}@itu.edu.tr`;
        const adminEmail = `admin${Math.floor(Math.random() * 10000)}@marinecadet.com`;
        const testPassword = 'Password123!';

        // 1. Admin Kullanıcısı Oluştur (Manuel)
        console.log(`\n0. Admin Oluşturuluyor (${adminEmail})...`);
        const adminUser = await User.create({
            name: 'Admin User',
            email: adminEmail,
            password: testPassword, // Model zaten hash'liyor!
            role: 'admin',
            isVerified: true,
            isApproved: true
        });
        console.log("✅ Admin Oluşturuldu.");

        // 2. Admin Login
        console.log("\n1. Admin Login Olunuyor...");
        const adminLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: adminEmail,
            password: testPassword
        });
        adminToken = adminLoginRes.data.token;
        console.log("✅ Admin Login Başarılı.");

        // 3. Öğrenci Kaydı (Barkodlu)
        console.log(`\n2. Öğrenci Kaydı Yapılıyor (${randomEmail})...`);
        try {
            await axios.post(`${API_URL}/auth/register`, {
                name: 'Test Student',
                email: randomEmail,
                password: testPassword,
                role: 'student',
                department: 'Güverte',
                classYear: '3. Sınıf',
                studentBarcode: 'EDEVLET-123456'
            });
            console.log("✅ Öğrenci Kaydı Başarılı. (Onay Bekliyor)");

            // Mail onayını bypass et
            const student = await User.findOneAndUpdate({ email: randomEmail }, { isVerified: true }, { new: true });
            studentId = student._id;
            console.log("✅ Öğrenci Mail Doğrulaması Yapıldı (DB bypass).");

        } catch (e) {
            console.log("⚠️ Kayıt Hatası:", e.response ? e.response.data : e.message);
        }

        // 4. Öğrenci Login Denemesi (BAŞARISIZ OLMALI)
        console.log("\n3. Öğrenci Login Denemesi (Onaysız)...");
        try {
            await axios.post(`${API_URL}/auth/login`, {
                email: randomEmail,
                password: testPassword
            });
            console.error("❌ HATA: Onaysız öğrenci giriş yapabildi! (BEKLENMEYEN DURUM)");
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log("✅ BAŞARILI: Onaysız öğrenci girişi engellendi (403).");
            } else {
                console.error("⚠️ Beklenmedik Hata:", error.message);
            }
        }

        // 5. Admin Onay Bekleyenleri Listele
        console.log("\n4. Bekleyen Kullanıcılar Listeleniyor...");
        const pendingRes = await axios.get(`${API_URL}/admin/pending-users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const found = pendingRes.data.find(u => u.email === randomEmail);
        if (found) {
            console.log("✅ Yeni öğrenci bekleme listesinde görüldü.");
        } else {
            console.error("❌ HATA: Öğrenci listede yok.");
        }

        // 6. Admin Onayı Ver
        console.log(`\n5. Öğrenci Onaylanıyor ID: ${studentId}...`);
        await axios.post(`${API_URL}/admin/approve-user/${studentId}`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("✅ Onay İşlemi Tamamlandı.");

        // 7. Öğrenci Login Denemesi (BAŞARILI OLMALI)
        console.log("\n6. Öğrenci Login Denemesi (Onaylı)...");
        const studentLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: randomEmail,
            password: testPassword
        });
        if (studentLoginRes.data.token) {
            console.log("✅ BAŞARILI: Onaylı öğrenci giriş yaptı.");
        } else {
            console.error("❌ HATA: Giriş yapılamadı.");
        }

        // Temizlik
        await User.findByIdAndDelete(adminUser._id);
        await User.findByIdAndDelete(studentId);
        console.log("\n🧹 Test verileri temizlendi.");

    } catch (error) {
        console.error("❌ TEST HATASI:", error.response ? error.response.data : error.message);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

testAdmin();
