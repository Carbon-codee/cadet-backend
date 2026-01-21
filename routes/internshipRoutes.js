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

        // --- MAİL GÖNDERME İŞLEMİ (DÜZELTİLMİŞ & PROFESYONEL) ---
        if (status === 'Onaylandı') {
            try {
                // Şirket Adı
                const companyName = internship.company.name;

                // DÜZELTME: Pozisyon Adı (İlan başlığı değil, Bölüm + Stajyeri yazsın)
                // Eğer veritabanında "Güverte" yazıyorsa "Güverte Stajyeri" yapsın.
                let positionName = internship.department;
                if (!positionName.toLowerCase().includes('stajyer')) {
                    positionName += ' Stajyeri';
                }

                const studentName = `${student.name} ${student.surname}`;
                const siteUrl = "https://marine-cadet.com";

                // HTML TASARIM (MAVİ TEMA)
                const htmlTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        .body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; width: 100%; }
                        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background-color: #003366; padding: 30px 0; text-align: center; }
                        .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
                        .content { padding: 40px 30px; color: #51545E; line-height: 1.6; }
                        .status-badge { display: inline-block; background-color: #e6fcf5; color: #0ca678; padding: 8px 16px; border-radius: 50px; font-weight: bold; font-size: 14px; margin-bottom: 20px; border: 1px solid #0ca678; }
                        .info-box { background-color: #f8f9fa; border-left: 4px solid #005A9C; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .info-item { margin-bottom: 8px; color: #333; font-size: 15px; }
                        .btn-container { text-align: center; margin-top: 30px; margin-bottom: 20px; }
                        .btn { background-color: #005A9C; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .footer { background-color: #f4f4f7; padding: 20px; text-align: center; font-size: 12px; color: #6b6e76; }
                    </style>
                </head>
                <body class="body">
                    <div class="container">
                        <div class="header"><h1>MARINE CADET</h1></div>
                        <div class="content">
                            <div style="text-align: center;">
                                <div class="status-badge">✅ BAŞVURUNUZ ONAYLANDI</div>
                            </div>
                            <p>Sayın <strong>${studentName}</strong>,</p>
                            <p>Harika bir haberimiz var! 🎉 Kariyer yolculuğunuzda önemli bir adım attınız.</p>
                            
                            <div class="info-box">
                                <div class="info-item"><strong>🏢 Şirket:</strong> ${companyName}</div>
                                <div class="info-item"><strong>⚓ Pozisyon:</strong> ${positionName}</div>
                                <div class="info-item"><strong>📅 İlan Başlığı:</strong> ${internship.title}</div>
                            </div>

                            <p>Başvurunuz şirket yetkilileri tarafından incelendi ve <strong>olumlu</strong> değerlendirildi. Staj süreci hakkında detaylı bilgi almak için lütfen panelinizi kontrol ediniz.</p>

                            <div class="btn-container">
                                <a href="${siteUrl}" class="btn">Panele Giriş Yap</a>
                            </div>
                            <p style="margin-top: 30px; font-size: 14px;">Denizcilik kariyerinizde başarılar dileriz,<br>Marine Cadet Ekibi</p>
                        </div>
                        <div class="footer">
                            <p>© 2026 Marine Cadet Platformu. Tüm hakları saklıdır.</p>
                        </div>
                    </div>
                </body>
                </html>
                `;

                await sendEmail({
                    email: student.email,
                    subject: `Tebrikler! ${companyName} Başvurunuzu Onayladı ⚓`,
                    html: htmlTemplate
                });

            } catch (emailError) {
                console.error("Mail gönderme hatası:", emailError);
            }
        }

        res.json({ message: `Durum güncellendi: ${status}` });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;