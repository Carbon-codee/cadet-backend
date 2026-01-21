const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');
const User = require('../models/User');
const { protect, isCompany, isStudent } = require('../middleware/authMiddleware');

// --- YENİ EKLENEN: Mail Gönderme Fonksiyonu ---
const sendEmail = require('../utils/sendEmail');
// ----------------------------------------------

// 1. Tüm AKTİF ilanları getir (Öğrenciler için)
router.get('/', async (req, res) => {
    try {
        const internships = await Internship.find({ isActive: true })
            .populate('company', 'name')
            .sort({ createdAt: -1 });
        res.json(internships);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// 2. Şirketin KENDİ ilanlarını getir (Aktif/Pasif Hepsi)
router.get('/company/mine', protect, isCompany, async (req, res) => {
    try {
        const internships = await Internship.find({ company: req.user._id })
            .sort({ createdAt: -1 });
        res.json(internships);
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// 3. Tek bir ilanı getir (Detay Sayfası İçin)
router.get('/:id', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id).populate('company', 'name email');
        if (internship) res.json(internship);
        else res.status(404).json({ message: 'İlan bulunamadı.' });
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// 4. Yeni ilan oluştur
router.post('/', protect, isCompany, async (req, res) => {
    try {
        const { title, shipType, location, startDate, duration, salary, description, department } = req.body;
        const internship = new Internship({
            title, shipType, location, startDate, duration, salary, description, department,
            company: req.user._id,
            isActive: true
        });
        const createdInternship = await internship.save();
        res.status(201).json(createdInternship);
    } catch (error) {
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

// 5. İlan güncelle
router.put('/:id', protect, isCompany, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'İlan bulunamadı' });
        if (internship.company.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Yetkisiz' });

        Object.assign(internship, req.body);
        const updated = await internship.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// 6. İlan Durumunu Değiştir (Yayından Kaldır/Al)
router.put('/:id/status', protect, isCompany, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'Bulunamadı' });
        if (internship.company.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Yetkisiz' });

        internship.isActive = !internship.isActive;
        await internship.save();
        res.json({ message: 'Durum güncellendi', isActive: internship.isActive });
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// 7. Başvuru Yap (Öğrenci)
router.post('/:id/apply', protect, isStudent, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        const student = await User.findById(req.user._id);

        if (!internship || !student) return res.status(404).json({ message: 'Kayıt bulunamadı' });
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
        res.status(500).json({ message: 'Hata: ' + error.message });
    }
});

// 8. ADAYLARI GETİR
router.get('/:id/applicants', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id)
            .populate('applicants.user', 'name surname email department classYear gpa englishLevel successScore');

        if (!internship) return res.status(404).json({ message: 'İlan bulunamadı.' });

        // Yetki Kontrolü
        const isOwner = req.user.role === 'company' && internship.company.toString() === req.user._id.toString();
        const isLecturer = req.user.role === 'lecturer';

        if (!isOwner && !isLecturer) return res.status(403).json({ message: 'Yetkisiz erişim.' });

        res.json(internship.applicants);
    } catch (error) {
        res.status(500).json({ message: 'Hata' });
    }
});

// 9. Başvuru Durumunu Güncelle (Onayla/Reddet) + MAİL GÖNDERİMİ
router.put('/:internshipId/applicants/:applicantId', protect, isCompany, async (req, res) => {
    const { status } = req.body;
    const { internshipId, applicantId } = req.params;

    try {
        // İlanı bulurken şirketin adını da çekiyoruz (populate) ki mailde yazalım
        const internship = await Internship.findById(internshipId).populate('company', 'name');
        const student = await User.findById(applicantId);

        if (!internship || !student) return res.status(404).json({ message: "Bulunamadı" });
        if (internship.company._id.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Yetkisiz" });

        // İlandaki durumu güncelle
        const appInInternship = internship.applicants.find(app => app.user.toString() === applicantId);
        if (appInInternship) appInInternship.status = status;
        else internship.applicants.push({ user: applicantId, status: status });

        // Öğrencideki durumu güncelle
        if (!student.applications) student.applications = [];
        const appInStudent = student.applications.find(app => app.internship && app.internship.toString() === internshipId);

        if (appInStudent) appInStudent.status = status;
        else student.applications.push({ internship: internshipId, status: status });

        await internship.save();
        await student.save();

        // --- MAİL GÖNDERME İŞLEMİ (EĞER ONAYLANDIYSA) ---
        if (status === 'Onaylandı') {
            try {
                const mailMessage = `
Merhaba ${student.name} ${student.surname},

Güzel bir haberimiz var! 🎉

"${internship.company.name}" şirketi, "${internship.title}" pozisyonu için yaptığınız staj başvurusunu ONAYLADI.

Staj sürecinizle ilgili sonraki adımlar için lütfen şirketle iletişime geçin veya Marine Cadet panelinizi kontrol edin.

Başarılar dileriz,
Marine Cadet Ekibi
                `;

                await sendEmail({
                    email: student.email,
                    subject: 'Tebrikler! Staj Başvurunuz Onaylandı 🚢',
                    message: mailMessage
                });

                console.log(`Onay maili gönderildi: ${student.email}`);
            } catch (emailError) {
                console.error("Mail gönderme hatası:", emailError);
                // Mail gitmese bile veritabanı işlemi başarılı olduğu için akışı bozmuyoruz.
            }
        }
        // ------------------------------------------------

        res.json({ message: `Durum güncellendi: ${status}` });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;