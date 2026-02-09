const mongoose = require('mongoose');
const User = require('./models/User');
const Internship = require('./models/Internship');

// .env dosyasını oku (Path'i backend klasörüne göre ayarla)
require('dotenv').config();

const checkUserApplications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Bağlandı");

        // İsimden kullanıcıyı bul (Şaban)
        const user = await User.findOne({ name: { $regex: 'aban', $options: 'i' } });

        if (!user) {
            console.log("Kullanıcı bulunamadı.");
            return;
        }

        console.log(`Kullanıcı Bulundu: ${user.name} (${user._id})`);
        console.log("Başvurular (Ham Veri):", user.applications);

        if (user.applications.length > 0) {
            console.log("\nDetaylı İnceleme:");
            for (const app of user.applications) {
                console.log(`- Başvuru ID: ${app._id}, Durum: ${app.status}`);
                console.log(`  İlan ID (ref): ${app.internship}`);

                const internship = await Internship.findById(app.internship);
                if (internship) {
                    console.log(`  -> İlan Bulundu: ${internship.title} (${internship.company})`);
                } else {
                    console.log(`  -> İLAN BULUNAMADI! (Silinmiş olabilir)`);
                }
            }
        } else {
            console.log("Bu kullanıcının hiç başvurusu yok (User modelinde).");
        }

        // Tüm ilanları gez ve bu kullanıcının ID'si var mı bak (Tersine Kontrol)
        console.log("\n--- TERSİNE KONTROL ---");
        const allInternships = await Internship.find({});
        let foundInInternships = 0;

        for (const int of allInternships) {
            if (int.applicants && int.applicants.length > 0) {
                const match = int.applicants.find(app =>
                    app.user.toString() === user._id.toString() ||
                    (app.user._id && app.user._id.toString() === user._id.toString())
                );

                if (match) {
                    console.log(`BULUNDU! İlan: "${int.title}" (ID: ${int._id}) içinde kullanıcı mevcut.`);
                    // status'ü kontrol et
                    console.log(`  İlan tarafındaki durum: ${match.status}`);

                    foundInInternships++;
                }
            }
        }

        if (foundInInternships === 0) {
            console.log("Kullanıcı hiçbir ilanın başvuru listesinde bulunamadı.");
        }
    } catch (error) {
        console.error("Hata:", error);
    } finally {
        await mongoose.disconnect();
    }
};

checkUserApplications();
