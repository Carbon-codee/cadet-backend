const mongoose = require('mongoose');
const User = require('./models/User');
const Internship = require('./models/Internship');

require('dotenv').config();

const syncApplications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Bağlandı - Senkronizasyon Başlıyor...");

        const allInternships = await Internship.find({});
        console.log(`Toplam ${allInternships.length} ilan tarandı.`);

        let fixedCount = 0;

        for (const internship of allInternships) {
            if (internship.applicants && internship.applicants.length > 0) {
                for (const app of internship.applicants) {
                    const userId = app.user;
                    const status = app.status;

                    const user = await User.findById(userId);
                    if (user) {
                        // Kullanıcının listesinde bu ilan var mı?
                        const exists = user.applications.some(a =>
                            (a.internship && a.internship.toString() === internship._id.toString())
                        );

                        if (!exists) {
                            console.log(`EKSİK BULUNDU: Kullanıcı ${user.name} için İlan ${internship.title}`);

                            user.applications.push({
                                internship: internship._id,
                                status: status
                            });

                            await user.save();
                            console.log("-> Eklendi ve Kaydedildi.");
                            fixedCount++;
                        }
                    }
                }
            }
        }

        console.log(`\nSenkronizasyon Tamamlandı. Toplam ${fixedCount} eksik başvuru düzeltildi.`);

    } catch (error) {
        console.error("Hata:", error);
    } finally {
        await mongoose.disconnect();
    }
};

syncApplications();
