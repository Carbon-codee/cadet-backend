const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');
const User = require('../models/User');
const { protect, isCompany, isStudent } = require('../middleware/authMiddleware');

// @desc    Tüm staj ilanlarını getir (Arama ve Filtreleme için populate edilmiş)
router.get('/', async (req, res) => {
    try {
        const internships = await Internship.find({})
            .populate('company', 'name') // Şirket adını getir
            .sort({ createdAt: -1 });
        res.json(internships);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu Hatası: ' + error.message });
    }
});

// @desc    Tek bir ilanı getir
router.get('/:id', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id).populate('company', 'name email');
        if (internship) {
            res.json(internship);
        } else {
            res.status(404).json({ message: 'İlan bulunamadı.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// @desc    Yeni ilan oluştur
router.post('/', protect, isCompany, async (req, res) => {
    try {
        const { title, shipType, location, startDate, duration, salary, description, department } = req.body;

        const internship = new Internship({
            title, shipType, location, startDate, duration, salary, description, department,
            company: req.user._id
        });

        const createdInternship = await internship.save();
        res.status(201).json(createdInternship);
    } catch (error) {
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

// @desc    İlan güncelle
router.put('/:id', protect, isCompany, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'İlan bulunamadı' });

        if (internship.company.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Yetkisiz işlem' });
        }

        Object.assign(internship, req.body);
        const updated = await internship.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

// ---------------------------------------------------------------------
// KRİTİK BÖLÜM: BAŞVURU YAPMA (Çift Taraflı Kayıt)
// ---------------------------------------------------------------------
router.post('/:id/apply', protect, isStudent, async (req, res) => {
    try {
        const internshipId = req.params.id;
        const studentId = req.user._id;

        const internship = await Internship.findById(internshipId);
        const student = await User.findById(studentId);

        if (!internship || !student) {
            return res.status(404).json({ message: 'Kayıt bulunamadı.' });
        }

        // Güvenlik: Diziler yoksa oluştur
        if (!internship.applicants) internship.applicants = [];
        if (!student.applications) student.applications = [];

        // Mükerrer Başvuru Kontrolü
        const alreadyApplied = internship.applicants.some(
            app => app.user.toString() === studentId.toString()
        );

        if (alreadyApplied) {
            return res.status(400).json({ message: 'Bu ilana zaten başvurdunuz.' });
        }

        // 1. İlana öğrenciyi ekle
        internship.applicants.push({ user: studentId, status: 'Beklemede' });

        // 2. Öğrenciye ilanı ekle
        student.applications.push({ internship: internshipId, status: 'Beklemede' });

        // İkisini de kaydet
        await internship.save();
        await student.save();

        res.status(200).json({ message: 'Başvuru başarıyla yapıldı.' });

    } catch (error) {
        console.error("Başvuru Hatası:", error);
        res.status(500).json({ message: 'Sunucu Hatası: ' + error.message });
    }
});

// ---------------------------------------------------------------------
// KRİTİK BÖLÜM: ŞİRKETİN ADAYLARI GÖRMESİ
// ---------------------------------------------------------------------
router.get('/:id/applicants', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id)
            // Öğrencinin tüm detaylarını çekiyoruz (soyadı dahil)
            .populate('applicants.user', 'name surname email department classYear gpa englishLevel');

        if (!internship) {
            return res.status(404).json({ message: 'İlan bulunamadı.' });
        }

        // Yetki: İlan sahibi şirket veya Hoca görebilir
        const isOwner = req.user.role === 'company' && internship.company.toString() === req.user._id.toString();
        const isLecturer = req.user.role === 'lecturer';

        if (!isOwner && !isLecturer) {
            return res.status(403).json({ message: 'Yetkisiz erişim.' });
        }

        // Listeyi döndür
        res.json(internship.applicants);

    } catch (error) {
        console.error("Adayları getirme hatası:", error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// @desc    Başvuru Durumu Güncelle (Onayla/Reddet) - Çift Taraflı
router.put('/:internshipId/applicants/:applicantId', protect, isCompany, async (req, res) => {
    const { status } = req.body;
    const { internshipId, applicantId } = req.params;

    try {
        const internship = await Internship.findById(internshipId);
        const student = await User.findById(applicantId);

        if (!internship || !student) return res.status(404).json({ message: "Bulunamadı" });
        if (internship.company.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Yetkisiz" });

        // İlandaki durumu güncelle
        const appInInternship = internship.applicants.find(app => app.user.toString() === applicantId);
        if (appInInternship) appInInternship.status = status;

        // Öğrencideki durumu güncelle (Varsa)
        if (student.applications) {
            const appInStudent = student.applications.find(app => app.internship.toString() === internshipId);
            if (appInStudent) appInStudent.status = status;
        }

        await internship.save();
        await student.save();

        res.json({ message: `Durum güncellendi: ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

module.exports = router;