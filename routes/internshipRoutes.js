const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');
const User = require('../models/User');
const { protect, isCompany, isStudent } = require('../middleware/authMiddleware');

// @desc    Tüm AKTİF staj ilanlarını getir (Öğrenciler için)
// @route   GET /api/internships
router.get('/', async (req, res) => {
    try {
        // Sadece isActive: true olanları getiriyoruz
        const internships = await Internship.find({ isActive: true })
            .populate('company', 'name')
            .sort({ createdAt: -1 });
        res.json(internships);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu Hatası: ' + error.message });
    }
});

// @desc    Şirketin KENDİ ilanlarını getir (Aktif/Pasif Hepsi)
// @route   GET /api/internships/company/mine
// @access  Private/Company
router.get('/company/mine', protect, isCompany, async (req, res) => {
    try {
        const internships = await Internship.find({ company: req.user._id })
            .sort({ createdAt: -1 });
        res.json(internships);
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// @desc    Tek bir ilanı getir
// @route   GET /api/internships/:id
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
// @route   POST /api/internships
router.post('/', protect, isCompany, async (req, res) => {
    try {
        const { title, shipType, location, startDate, duration, salary, description, department } = req.body;

        const internship = new Internship({
            title, shipType, location, startDate, duration, salary, description, department,
            company: req.user._id,
            isActive: true // Varsayılan olarak yayında
        });

        const createdInternship = await internship.save();
        res.status(201).json(createdInternship);
    } catch (error) {
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

// @desc    İlan güncelle
// @route   PUT /api/internships/:id
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

// @desc    İlan Durumunu Değiştir (Yayından Kaldır / Yayına Al)
// @route   PUT /api/internships/:id/status
router.put('/:id/status', protect, isCompany, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'Bulunamadı' });

        if (internship.company.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Yetkisiz' });
        }

        // Durumu tersine çevir (True -> False / False -> True)
        internship.isActive = !internship.isActive;
        await internship.save();

        res.json({ message: `İlan durumu: ${internship.isActive ? 'Yayında' : 'Kaldırıldı'}`, isActive: internship.isActive });
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// @desc    Başvuru Yap
// @route   POST /api/internships/:id/apply
router.post('/:id/apply', protect, isStudent, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        const student = await User.findById(req.user._id);

        if (!internship || !student) return res.status(404).json({ message: 'Kayıt bulunamadı.' });

        if (!internship.applicants) internship.applicants = [];
        if (!student.applications) student.applications = [];

        const alreadyApplied = internship.applicants.some(app => app.user.toString() === req.user._id.toString());
        if (alreadyApplied) return res.status(400).json({ message: 'Zaten başvurdunuz.' });

        internship.applicants.push({ user: req.user._id, status: 'Beklemede' });
        student.applications.push({ internship: req.params.id, status: 'Beklemede' });

        await internship.save();
        await student.save();

        res.status(200).json({ message: 'Başvuru başarılı.' });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu Hatası: ' + error.message });
    }
});

// @desc    Şirketin Adayları Görmesi
// @route   GET /api/internships/:id/applicants
// @desc    Başvuru Durumu Güncelle (Onayla/Reddet) - Hata Düzeltildi
router.put('/:internshipId/applicants/:applicantId', protect, isCompany, async (req, res) => {
    const { status } = req.body;
    const { internshipId, applicantId } = req.params;

    try {
        const internship = await Internship.findById(internshipId);
        const student = await User.findById(applicantId);

        if (!internship || !student) return res.status(404).json({ message: "Bulunamadı" });
        if (internship.company.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Yetkisiz" });

        // 1. İlanın içindeki başvuruyu güncelle
        const appInInternship = internship.applicants.find(app => app.user.toString() === applicantId);
        if (appInInternship) {
            appInInternship.status = status;
        } else {
            // Eğer ilanda yoksa, ekle (Onarım)
            internship.applicants.push({ user: applicantId, status: status });
        }

        // 2. Öğrencinin içindeki başvuruyu güncelle
        // Eğer applications dizisi yoksa oluştur
        if (!student.applications) student.applications = [];

        const appInStudent = student.applications.find(app => app.internship && app.internship.toString() === internshipId);

        if (appInStudent) {
            appInStudent.status = status;
        } else {
            // Eğer öğrencinin listesinde yoksa, ekle (Onarım)
            student.applications.push({ internship: internshipId, status: status });
        }

        await internship.save();
        await student.save();

        res.json({ message: `Durum güncellendi: ${status}` });
    } catch (error) {
        console.error("Durum güncelleme hatası:", error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;