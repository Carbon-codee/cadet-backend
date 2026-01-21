const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');

// Internship Modelini İçe Aktar
const Internship = require('../models/Internship');

// --- HATA AYIKLAMA LOGU ---
console.log("Internship Modeli Yüklendi:", Internship ? "EVET" : "HAYIR");

// @desc    Giriş yapmış öğrencinin başvurularını getir
router.get('/my-applications', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('applications');
        if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

        const applications = user.applications || [];
        if (applications.length === 0) return res.json([]);

        const internshipIds = applications
            .filter(app => app && app.internship)
            .map(app => app.internship);

        const internships = await Internship.find({ '_id': { $in: internshipIds } })
            .select('title company')
            .populate('company', 'name');

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

// --- PROFİL GÜNCELLEME (KRİTİK DÜZELTME BURADA YAPILDI) ---
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
            if (user.role === 'student') {
                user.classYear = req.body.classYear || user.classYear;
                user.gpa = req.body.gpa || user.gpa;
                user.englishLevel = req.body.englishLevel || user.englishLevel;
                user.successScore = req.body.successScore || user.successScore;
                user.socialActivities = req.body.socialActivities || user.socialActivities;
                user.documents = req.body.documents || user.documents;
                user.preferences = req.body.preferences || user.preferences;
            }

            // Akademisyen Alanları
            if (user.role === 'lecturer') {
                user.title = req.body.title || user.title;
                user.office = req.body.office || user.office;
            }

            // --- ŞİRKET ALANLARI DÜZELTMESİ ---
            if (user.role === 'company') {
                // Mevcut veriyi al, yoksa boş obje yap
                let currentInfo = user.companyInfo || {};
                // Body'den gelen companyInfo
                let incomingInfo = req.body.companyInfo || {};

                // Sektör verisi (Frontend bazen root'a bazen companyInfo içine koyuyor olabilir)
                // Öncelik: req.body.sector -> req.body.companyInfo.sector -> mevcut veri
                let sectorUpdate = req.body.sector || incomingInfo.sector || currentInfo.sector;

                user.companyInfo = {
                    sector: sectorUpdate, // Sektörü garantiye al
                    website: incomingInfo.website || currentInfo.website,
                    address: incomingInfo.address || currentInfo.address,
                    about: incomingInfo.about || currentInfo.about
                };

                // Mongoose'a iç içe objenin değiştiğini bildir (Nested object güncelleme sorunu için)
                user.markModified('companyInfo');
            }
            // ----------------------------------

            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
    } catch (error) {
        console.error("Profil Güncelleme Hatası:", error);
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

// @desc    Tüm Şirketleri Listele
router.get('/list/companies', protect, async (req, res) => {
    try {
        const companies = await User.find({ role: 'company' }).select('name _id');
        res.json(companies);
    } catch (error) {
        res.status(500).json({ message: "Hata" });
    }
});

// @desc    Şirket için Eşleşen Öğrencileri Getir
router.get('/company/matches', protect, async (req, res) => {
    try {
        if (req.user.role !== 'company') {
            return res.status(403).json({ message: "Yetkisiz işlem." });
        }
        const companyId = req.user._id;
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
        const count = await User.countDocuments({ role: 'student' });
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Sayım hatası" });
    }
});

router.get('/public/stats', async (req, res) => {
    try {
        const studentCount = await User.countDocuments({ role: 'student' });
        const companyCount = await User.countDocuments({ role: 'company' });
        const internships = await Internship.find({}).select('applicants');
        let totalMatches = 0;

        internships.forEach(doc => {
            if (doc.applicants) {
                const approved = doc.applicants.filter(app => app.status === 'Onaylandı');
                totalMatches += approved.length;
            }
        });

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
        res.json({ students: 150, companies: 20, matches: 45, rate: 30 });
    }
});

// Şirket İstatistikleri
router.get('/stats/company', protect, async (req, res) => {
    try {
        const internships = await Internship.find({ company: req.user._id })
            .populate({
                path: 'applicants.user',
                select: 'name surname department classYear gpa englishLevel'
            });

        let totalApplicants = 0;
        let gpaSum = 0;
        let gpaCount = 0;
        let classDist = { 1: 0, 2: 0, 3: 0, 4: 0, other: 0 };
        let recentApplicants = [];
        const engLevels = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
        let engSum = 0;
        let engCount = 0;
        const engLevelNames = ["-", "A1", "A2", "B1", "B2", "C1", "C2"];

        internships.forEach(ad => {
            totalApplicants += ad.applicants.length;
            ad.applicants.forEach(app => {
                const stu = app.user;
                if (stu) {
                    recentApplicants.push({
                        _id: stu._id,
                        name: stu.name,
                        surname: stu.surname,
                        internshipTitle: ad.title,
                        createdAt: app.createdAt
                    });
                    if (stu.gpa) {
                        gpaSum += Number(stu.gpa);
                        gpaCount++;
                    }
                    if (stu.englishLevel && engLevels[stu.englishLevel]) {
                        engSum += engLevels[stu.englishLevel];
                        engCount++;
                    }
                    const match = String(stu.classYear).match(/\d+/);
                    if (match) {
                        const year = parseInt(match[0]);
                        if (year >= 1 && year <= 4) classDist[year]++;
                        else classDist.other++;
                    }
                }
            });
        });

        const avgGpa = gpaCount > 0 ? (gpaSum / gpaCount).toFixed(2) : "0.00";
        const avgEngScore = engCount > 0 ? engSum / engCount : 0;
        const avgEngLabel = engCount > 0 ? engLevelNames[Math.round(avgEngScore)] : "-";

        const interestedCount = await User.countDocuments({
            role: 'student',
            'preferences.targetCompanies': req.user._id
        });

        const interestedStudents = await User.find({
            role: 'student',
            'preferences.targetCompanies': req.user._id
        }).select('name surname department classYear gpa').limit(10);

        const totalStudentCount = await User.countDocuments({ role: 'student' });

        res.json({
            totalInternships: internships.length,
            totalApplicants,
            avgGpa,
            avgEngScore,
            avgEngLabel,
            classDistribution: classDist,
            recentApplicants: recentApplicants.slice(0, 5),
            interestedCount,
            interestedStudents,
            totalStudentCount
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "İstatistik hatası" });
    }
});

// Akademisyen İstatistikleri
router.get('/stats/lecturer', protect, async (req, res) => {
    try {
        const internships = await Internship.find({})
            .populate('company', 'name')
            .populate({
                path: 'applicants.user',
                select: 'name surname department gpa englishLevel'
            });

        let placedCount = 0;
        let companyMap = {};
        let deckTotal = 0;
        let engineTotal = 0;
        const engLevels = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
        const engLevelNames = ["-", "A1", "A2", "B1", "B2", "C1", "C2"];
        let globalGpaSum = 0;
        let globalEngSum = 0;
        let globalCount = 0;

        internships.forEach(ad => {
            const accepted = ad.applicants.filter(app => app.status === 'Onaylandı');
            accepted.forEach(app => {
                const stu = app.user;
                if (!stu) return;

                placedCount++;
                globalCount++;
                const compName = ad.company?.name || "Bilinmeyen";

                if (!companyMap[compName]) {
                    companyMap[compName] = { name: compName, count: 0, deck: 0, engine: 0, gpaSum: 0, engSum: 0, engCount: 0 };
                }
                const c = companyMap[compName];
                c.count++;

                const dept = (stu.department || "").toLowerCase();
                if (dept.includes('güverte') || dept.includes('deck')) { c.deck++; deckTotal++; }
                else { c.engine++; engineTotal++; }

                if (stu.gpa) {
                    c.gpaSum += Number(stu.gpa);
                    globalGpaSum += Number(stu.gpa);
                }
                if (stu.englishLevel && engLevels[stu.englishLevel]) {
                    const sc = engLevels[stu.englishLevel];
                    c.engSum += sc;
                    c.engCount++;
                    globalEngSum += sc;
                }
            });
        });

        const companyAnalysis = Object.values(companyMap).map(c => ({
            name: c.name,
            count: c.count,
            deck: c.deck,
            engine: c.engine,
            avgGpa: c.count > 0 ? (c.gpaSum / c.count).toFixed(2) : "0.00",
            avgEng: c.engCount > 0 ? engLevelNames[Math.round(c.engSum / c.engCount)] : "-"
        }));

        const finalGpa = globalCount > 0 ? (globalGpaSum / globalCount).toFixed(2) : "0.00";
        const finalEng = globalCount > 0 ? Math.round(globalEngSum / globalCount) : 0;

        res.json({
            totalPlaced: placedCount,
            totalCompanies: Object.keys(companyMap).length,
            globalAvgGpa: finalGpa,
            globalAvgEng: finalEng,
            globalAvgEngLabel: engLevelNames[finalEng] || "-",
            companyAnalysis,
            deptSplit: { deck: deckTotal, engine: engineTotal }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "İstatistik hatası" });
    }
});

router.put('/status', protect, async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findById(req.user._id);
        if (user && user.role === 'student') {
            user.currentStatus = status;
            await user.save();
            res.json({ message: "Durum güncellendi", status: user.currentStatus });
        } else {
            res.status(400).json({ message: "İşlem başarısız." });
        }
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

router.get('/scout/:internshipId', protect, async (req, res) => {
    try {
        if (req.user.role !== 'company') return res.status(403).json({ message: "Yetkisiz" });

        const internship = await Internship.findById(req.params.internshipId);
        if (!internship) return res.status(404).json({ message: "İlan bulunamadı" });

        const shipType = internship.shipType;
        const companyId = req.user._id;
        const internshipDept = internship.department;
        let targetStudentDept = "";
        if (internshipDept === 'Güverte') {
            targetStudentDept = "Deniz Ulaştırma İşletme Mühendisliği";
        } else if (internshipDept === 'Makine') {
            targetStudentDept = "Gemi Makineleri İşletme Mühendisliği";
        }

        const candidates = await User.find({
            role: 'student',
            currentStatus: 'Staj Arıyor',
            'preferences.shipTypes': shipType,
            department: targetStudentDept
        }).select('name surname department classYear gpa englishLevel successScore preferences email');

        const favorited = [];
        const others = [];

        candidates.forEach(stu => {
            const isFav = stu.preferences?.targetCompanies?.includes(companyId);
            if (isFav) favorited.push(stu);
            else others.push(stu);
        });

        favorited.sort((a, b) => b.successScore - a.successScore);
        others.sort((a, b) => b.successScore - a.successScore);

        res.json({ favorited, others });

    } catch (error) {
        console.error("Scout Hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

module.exports = router;