const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Bağlandı.");

        const adminEmail = "admin@marinecadet.com";
        const password = "Admin123!";

        // Önce var mı diye kontrol et
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log("Admin hesabı zaten var:");
            console.log("Email:", adminEmail);
            console.log("Şifre: (Zaten ayarlı, değiştirilmedi)");
            process.exit();
        }

        const user = await User.create({
            name: "Süper Admin",
            surname: "Yönetici",
            email: adminEmail,
            password: password, // Model hash'leyecek
            role: "admin",
            isVerified: true,
            isApproved: true,
            studentBarcode: "ADMIN-001"
        });

        console.log("\n✅ Admin Hesabı Oluşturuldu!");
        console.log("📧 Email: " + adminEmail);
        console.log("🔑 Şifre: " + password);
        console.log("-----------------------------------");

        process.exit();
    } catch (error) {
        console.error("Hata:", error);
        process.exit(1);
    }
};

createAdmin();
