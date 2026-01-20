const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// sendEmail importunun aktif olduğundan emin ol
const sendEmail = require('../utils/sendEmail');
const { protect } = require('../middleware/authMiddleware');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'gizli_anahtar', { expiresIn: '30d' });
};

// @desc    Kullanıcı Kaydı (MAİL GÖNDERİMİ AKTİF)
router.post('/register', async (req, res) => {
    // Frontend'den gelen tüm olası alanları alıyoruz
    const { name, email, password, role, department, classYear } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda.' });
        }

        const verificationToken = crypto.randomBytes(20).toString('hex');

        const user = await User.create({
            name, email, password, role, department, classYear,
            isVerified: false, // ONAY BEKLİYOR
            verificationToken: verificationToken,
            currentStatus: 'Okulda/Tatilde' // Varsayılan durum
        });

        if (user) {
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
            const message = `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #002B5B;">Cadet Platformuna Hoş Geldin!</h2>
                    <p>Hesabını aktifleştirmek için aşağıdaki butona tıkla:</p>
                    <a href="${verifyUrl}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display:inline-block; margin:20px 0;">Hesabımı Doğrula</a>
                </div>
            `;

            try {
                await sendEmail({ email: user.email, subject: 'Cadet Hesap Doğrulama', message });
                res.status(201).json({ message: "Kayıt başarılı! Lütfen e-postanıza gelen doğrulama linkine tıklayın." });
            } catch (emailError) {
                // Mail gidemezse, oluşturulan kullanıcıyı silerek sistemi temiz tutuyoruz.
                await User.findByIdAndDelete(user._id);
                res.status(500).json({ message: "Mail gönderilemedi, kayıt işlemi başarısız oldu." });
            }
        }
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Kullanıcı Girişi (DOĞRULAMA KONTROLLÜ)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {

            // --- KONTROL DEVREDE ---
            if (!user.isVerified) {
                return res.status(401).json({ message: "Lütfen önce e-posta adresinizi doğrulayın." });
            }
            // ---------------------

            // Başarılı girişte TÜM verileri gönder
            res.json({
                _id: user._id,
                token: generateToken(user._id),
                name: user.name,
                surname: user.surname,
                email: user.email,
                role: user.role,
                currentStatus: user.currentStatus,
                department: user.department,
                classYear: user.classYear,
                gpa: user.gpa,
                englishLevel: user.englishLevel,
                bio: user.bio,
                socialActivities: user.socialActivities,
                documents: user.documents,
                successScore: user.successScore,
                title: user.title,
                office: user.office,
                companyInfo: user.companyInfo,
                preferences: user.preferences
            });
        } else {
            res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' });
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// @desc    E-posta Doğrulama (Linke tıklanınca çalışır)
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    try {
        const user = await User.findOne({ verificationToken: token });
        if (!user) return res.status(400).json({ message: "Geçersiz veya süresi dolmuş link." });

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.json({ message: "Hesabınız başarıyla doğrulandı! Giriş yapabilirsiniz." });
    } catch (error) { res.status(500).json({ message: "Doğrulama hatası." }); }
});


// @desc    ŞİFREMİ UNUTTUM (Mail Gönder)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Bu e-postaya sahip kullanıcı bulunamadı." });

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 dakika
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const message = `<h2>Şifre Sıfırlama İsteği</h2><p>Şifreni sıfırlamak için aşağıdaki linke tıkla (10 dakika geçerlidir):</p><a href="${resetUrl}">Şifremi Sıfırla</a>`;

        await sendEmail({ email: user.email, subject: 'Cadet Şifre Sıfırlama', message });
        res.json({ message: 'Şifre sıfırlama linki e-postanıza gönderildi.' });
    } catch (error) {
        res.status(500).json({ message: "İşlem sırasında hata oluştu." });
    }
});

// @desc    YENİ ŞİFREYİ KAYDET
router.put('/reset-password/:token', async (req, res) => {
    const { password } = req.body;
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Geçersiz veya süresi dolmuş link." });

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.json({ message: "Şifreniz başarıyla değiştirildi. Şimdi giriş yapabilirsiniz." });
    } catch (error) {
        res.status(500).json({ message: "Şifre sıfırlanamadı." });
    }
});

// @desc    Kullanıcı Profilini Getir (Token ile)
router.get('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) { res.status(500).json({ message: 'Hata.' }); }
});

// @desc    Profili Güncelle
router.put('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            Object.assign(user, req.body);
            if (req.body.companyInfo) user.companyInfo = { ...user.companyInfo, ...req.body.companyInfo };
            if (req.body.preferences) user.preferences = { ...user.preferences, ...req.body.preferences };
            const updatedUser = await user.save();
            res.json({ ...updatedUser._doc, token: generateToken(updatedUser._id) });
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) { res.status(500).json({ message: 'Hata.' }); }
});

module.exports = router;