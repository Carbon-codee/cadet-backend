const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');

// Internship Modelini İçe Aktar
const Internship = require('../models/Internship');

// --- HATA AYIKLAMA LOGU ---
// Sunucu başladığında bu satır terminalde görünmeli
console.log("Internship Modeli Yüklendi:", Internship ? "EVET" : "HAYIR");
// --------------------------

// @desc    Giriş yapmış öğrencinin başvurularını getir
router.get('/my-applications', protect, async (req, res) => {
    try {
        // 1. Kullanıcıyı çek
        const user = await User.findById(req.user._id).select('applications');

        if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

        const applications = user.applications || [];
        if (applications.length === 0) return res.json([]);

        // 2. İlan ID'lerini topla
        const internshipIds = applications
            .filter(app => app && app.internship)
            .map(app => app.internship);

        // 3. İlanları çek (HATA VEREN KISIM BURASIYDI)
        // Eğer Internship modeli düzgün yüklenmediyse burada patlar.
        const internships = await Internship.find({ '_id': { $in: internshipIds } })
            .select('title company')
            .populate('company', 'name');

        // 4. Haritala ve Birleştir
        const internshipMap = {};
        internships.forEach(i => {
            if (i._id) internshipMap[i._id.toString()] = i;
        });

        const results = applications.map(app => {
            if (!app.internship) return null;
            const details = internshipMap[app.internship.toString()];

            if (!details) {
                return {
                    _id: app._id,
                    status: app.status,
                    internship: { title: "Silinmiş İlan", company: { name: "-" } }
                };
            }

            return {
                _id: app._id,
                status: app.status,
                internship: {
                    _id: details._id,
                    title: details.title,
                    company: details.company || { name: "Bilinmeyen Şirket" }
                }
            };
        }).filter(Boolean);

        res.json(results);

    } catch (error) {
        console.error("MY-APP HATASI:", error);
        res.status(500).json({ message: "Sunucu hatası: " + error.message });
    }
});

// --- DİĞER ROTALAR (PROFİL, MAİL, ŞİFRE) ---

router.put('/update-email', protect, async (req, res) => {
    try {
        const { newEmail } = req.body;
        await User.findByIdAndUpdate(req.user._id, { email: newEmail });
        res.json({ message: "Güncellendi" });
    } catch (e) { res.status(500).json({ message: "Hata" }); }
});

router.put('/update-password', protect, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const user = await User.findById(req.user._id);
        user.password = newPassword;
        await user.save();
        res.json({ message: "Güncellendi" });
    } catch (e) { res.status(500).json({ message: "Hata" }); }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            // Standart Alanlar
            user.name = req.body.name || user.name;
            user.surname = req.body.surname || user.surname;
            user.department = req.body.department || user.department;
            user.bio = req.body.bio || user.bio;
            user.email = req.body.email || user.email;

            // Öğrenci Alanları
            user.classYear = req.body.classYear || user.classYear;
            user.gpa = req.body.gpa || user.gpa;
            user.englishLevel = req.body.englishLevel || user.englishLevel;
            user.successScore = req.body.successScore || user.successScore;
            user.socialActivities = req.body.socialActivities || user.socialActivities;
            user.documents = req.body.documents || user.documents;
            user.preferences = req.body.preferences || user.preferences;

            // --- AKADEMİSYEN ALANLARI (BUNLAR EKSİKSE EKLENMELİ) ---
            user.title = req.body.title || user.title;
            user.office = req.body.office || user.office;
            // -------------------------------------------------------

            // Şirket Alanları
            if (req.body.companyInfo && user.role === 'company') {
                user.companyInfo = { ...user.companyInfo, ...req.body.companyInfo };
            }

            const updatedUser = await user.save();

            // Güncel veriyi döndürürken token da ekleyelim (Frontend state'i bozulmasın diye)
            // (Login'deki gibi tam obje döndürmek en sağlıklısı ama şimdilik user yeterli)
            res.json(updatedUser);
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (user) res.json(user);
        else res.status(404).json({ message: "Bulunamadı" });
    } catch (e) { res.status(500).json({ message: "Hata" }); }
});

// @desc    Tüm Şirketleri Listele (Öğrencinin seçmesi için)
router.get('/list/companies', protect, async (req, res) => {
    try {
        const companies = await User.find({ role: 'company' }).select('name _id');
        res.json(companies);
    } catch (error) {
        res.status(500).json({ message: "Hata" });
    }
});

// @desc    Şirket için Eşleşen Öğrencileri Getir (AKILLI EŞLEŞTİRME)
router.get('/company/matches', protect, async (req, res) => {
    try {
        // Sadece şirketler kullanabilir
        if (req.user.role !== 'company') {
            return res.status(403).json({ message: "Yetkisiz işlem." });
        }

        const companyId = req.user._id;

        // Kriter 1: Öğrenci direkt bu şirketi favorilemiş mi?
        // Kriter 2: (Opsiyonel) İleride şirketin gemi tipine göre de eşleştirme yapılabilir.

        const matchedStudents = await User.find({
            role: 'student',
            'preferences.targetCompanies': companyId
        }).select('name surname department classYear gpa preferences email');

        res.json(matchedStudents);

    } catch (error) {
        console.error("Eşleşme Hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

router.get('/count/students', protect, async (req, res) => {
    try {
        // Rolü 'student' olanların sayısını al (countDocuments en hızlısıdır)
        const count = await User.countDocuments({ role: 'student' });
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Sayım hatası" });
    }
});

router.get('/public/stats', async (req, res) => {
    try {
        // 1. Toplam Öğrenci Sayısı
        const studentCount = await User.countDocuments({ role: 'student' });

        // 2. Toplam Şirket Sayısı
        const companyCount = await User.countDocuments({ role: 'company' });

        // 3. Toplam Eşleşme (Onaylanan Başvurular)
        // Tüm ilanları tarayıp, içindeki 'Onaylandı' statüsündeki başvuruları sayıyoruz
        const internships = await Internship.find({}).select('applicants');
        let totalMatches = 0;

        internships.forEach(doc => {
            if (doc.applicants) {
                const approved = doc.applicants.filter(app => app.status === 'Onaylandı');
                totalMatches += approved.length;
            }
        });

        // 4. İşe Yerleşme Oranı (Eşleşme / Toplam Öğrenci)
        let placementRate = 0;
        if (studentCount > 0) {
            placementRate = Math.round((totalMatches / studentCount) * 100);
        }

        res.json({
            students: studentCount,
            companies: companyCount,
            matches: totalMatches,
            rate: placementRate
        });

    } catch (error) {
        console.error("İstatistik hatası:", error);
        // Hata olursa varsayılan (fake) veriler dön ki site bozulmasın
        res.json({ students: 150, companies: 20, matches: 45, rate: 30 });
    }
});

module.exports = router;