const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Internship = require('../models/Internship'); // İstatistik için gerekli
const { protect, isAdmin } = require('../middleware/authMiddleware');

// @desc    Onay Bekleyen Kullanıcıları Listele (PENDING)
// @route   GET /api/admin/pending-users
// @access  Private/Admin
router.get('/pending-users', protect, isAdmin, async (req, res) => {
    try {
        // isApproved: false VEYA (eski kayıtlar için) hiç yoksa
        const users = await User.find({
            $or: [
                { isApproved: false },
                { isApproved: { $exists: false } }
            ]
        }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Kullanıcıyı Onayla
// @route   POST /api/admin/approve-user/:id
// @access  Private/Admin
router.post('/approve-user/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        user.isApproved = true;
        user.status = 'approved';
        await user.save();

        res.json({ message: 'Kullanıcı başarıyla onaylandı.', user });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Kullanıcıyı Reddet (SİL)
// @route   POST /api/admin/reject-user/:id
// @access  Private/Admin
router.post('/reject-user/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'Kullanıcı reddedildi ve silindi.' });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Sistem İstatistiklerini Getir
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, isAdmin, async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalCompanies = await User.countDocuments({ role: 'company' });
        const totalLecturers = await User.countDocuments({ role: 'lecturer' });
        const totalInternships = await Internship.countDocuments({});

        // Toplam başvuru sayısını hesapla (Tüm ilanlardaki başvuru sayılarının toplamı)
        const applicationStats = await Internship.aggregate([
            { $project: { count: { $size: "$applicants" } } },
            { $group: { _id: null, total: { $sum: "$count" } } }
        ]);
        const totalApplications = applicationStats.length > 0 ? applicationStats[0].total : 0;

        // Yerleşen (Onaylanan) başvuru sayısı
        const placementStats = await Internship.aggregate([
            { $unwind: "$applicants" },
            { $match: { "applicants.status": "Onaylandı" } },
            { $count: "total" }
        ]);
        const totalPlacements = placementStats.length > 0 ? placementStats[0].total : 0;

        res.json({
            totalStudents,
            totalCompanies,
            totalLecturers,
            totalInternships,
            totalApplications,
            totalPlacements
        });
    } catch (error) {
        res.status(500).json({ message: 'İstatistik hatası: ' + error.message });
    }
});

// @desc    Tüm Kullanıcıları Listele (Filtreli)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, isAdmin, async (req, res) => {
    try {
        const { role } = req.query;
        let query = {};

        if (role) {
            query.role = role;
        }

        // Onaylı/Onaysız hepsini getir (Pending hariç, onları zaten diğer endpoint getiriyor diye düşünmeyelim, hepsini görelim)
        const users = await User.find(query).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı listesi hatası: ' + error.message });
    }
});

const Message = require('../models/Message'); // Mesaj modeli eklendi

// @desc    Kullanıcıya Özel Mail Gönder (+ Sistem İçi Mesaj)
// @route   POST /api/admin/send-custom-email
// @access  Private/Admin
router.post('/send-custom-email', protect, isAdmin, async (req, res) => {
    const { userId, subject, message } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // 1. E-POSTA GÖNDERİMİ
        const mailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
                <h2 style="color: #005A9C;">Admin Mesajı</h2>
                <p>Sayın <strong>${user.name}</strong>,</p>
                <p>Yönetici tarafından size aşağıdaki mesaj gönderildi:</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #005A9C; margin: 20px 0;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #777;">Bu mesaj Marine Cadet Yönetim Paneli üzerinden gönderilmiştir.</p>
            </div>
        `;

        await require('../utils/sendEmail')({
            email: user.email,
            subject: subject || 'Marine Cadet Yöneticisinden Mesaj',
            html: mailHtml
        });

        // 2. SİSTEM İÇİ MESAJ KAYDI (YENİ)
        // Admin kullanıcısının ID'sini gönderici olarak kullanıyoruz.
        await Message.create({
            sender: req.user._id,
            receiver: user._id,
            subject: subject || 'Admin Mesajı',
            content: message
        });

        res.json({ message: 'E-posta ve site içi mesaj başarıyla gönderildi.' });
    } catch (error) {
        console.error("Mail/Mesaj Hatası:", error);
        res.status(500).json({ message: 'İşlem başarısız: ' + error.message });
    }
});

module.exports = router;
