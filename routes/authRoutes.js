const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail'); // Resend entegreli mail fonksiyonun
const { protect } = require('../middleware/authMiddleware');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'gizli_anahtar', { expiresIn: '30d' });
};

// @desc    Kullanıcı Kaydı + PROFESYONEL DOĞRULAMA MAİLİ
router.post('/register', async (req, res) => {
    const { name, email, password, role, department, classYear } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda.' });
        }

        const verificationToken = crypto.randomBytes(20).toString('hex');

        const user = await User.create({
            name, email, password, role, department, classYear,
            isVerified: false,
            verificationToken: verificationToken,
            currentStatus: 'Okulda/Tatilde'
        });

        if (user) {
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
            const siteUrl = "https://marinecadet.com";

            // --- PROFESYONEL HOŞ GELDİN & DOĞRULAMA MAİLİ ---
            const welcomeHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    .body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; width: 100%; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background-color: #005A9C; padding: 30px 0; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
                    .content { padding: 40px 30px; color: #51545E; line-height: 1.6; }
                    .btn { background-color: #27ae60; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .footer { background-color: #f4f4f7; padding: 20px; text-align: center; font-size: 12px; color: #6b6e76; }
                </style>
            </head>
            <body class="body">
                <div class="container">
                    <div class="header"><h1>ARAMIZA HOŞ GELDİN! ⚓</h1></div>
                    <div class="content">
                        <p>Merhaba <strong>${name}</strong>,</p>
                        <p>Marine Cadet ailesine katıldığın için çok mutluyuz! 🎉</p>
                        <p>Platformumuz sayesinde staj ilanlarını inceleyebilir, şirketlerle eşleşebilir ve denizcilik kariyerine güçlü bir başlangıç yapabilirsin.</p>
                        
                        <p>Hesabını aktifleştirmek ve hemen kullanmaya başlamak için lütfen aşağıdaki butona tıkla:</p>
    
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verifyUrl}" class="btn">Hesabımı Doğrula</a>
                        </div>

                        <p style="font-size: 12px; color: #999;">Linke tıklayamıyorsanız: ${verifyUrl}</p>
                    </div>
                    <div class="footer">
                        <p>© 2026 Marine Cadet Platformu.</p>
                    </div>
                </div>
            </body>
            </html>
            `;
            // ------------------------------------------------

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Marine Cadet\'e Hoş Geldiniz! 🚢 Lütfen Hesabınızı Doğrulayın',
                    html: welcomeHtml // HTML tasarımını gönderiyoruz
                });
                res.status(201).json({ message: "Kayıt başarılı! Lütfen e-postanıza gelen doğrulama linkine tıklayın." });
            } catch (emailError) {
                await User.findByIdAndDelete(user._id);
                res.status(500).json({ message: "Mail gönderilemedi, kayıt işlemi başarısız oldu." });
            }
        }
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Kullanıcı Girişi
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            if (!user.isVerified) {
                return res.status(401).json({ message: "Lütfen önce e-posta adresinizi doğrulayın." });
            }

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

// @desc    E-posta Doğrulama
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


// @desc    ŞİFREMİ UNUTTUM + PROFESYONEL TURUNCU MAİL
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

        // --- GÜVENLİK TEMALI (TURUNCU) TASARIM ---
        const resetHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                .body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; width: 100%; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background-color: #d9480f; padding: 30px 0; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
                .content { padding: 40px 30px; color: #51545E; line-height: 1.6; }
                .btn { background-color: #d9480f; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; display: inline-block; }
                .footer { background-color: #f4f4f7; padding: 20px; text-align: center; font-size: 12px; color: #6b6e76; }
            </style>
        </head>
        <body class="body">
            <div class="container">
                <div class="header"><h1>ŞİFRE SIFIRLAMA</h1></div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p>Hesabınız için bir şifre sıfırlama talebi aldık. Bu işlemi siz yapmadıysanız, hesabınız güvendedir ve bu maili silebilirsiniz.</p>
                    <p>Şifrenizi yenilemek için aşağıdaki butona tıklayın (Link 10 dakika geçerlidir):</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" class="btn">Şifremi Sıfırla</a>
                    </div>
                    
                    <p style="font-size: 12px; color: #999;">Butona tıklayamıyorsanız: ${resetUrl}</p>
                </div>
                <div class="footer">
                    <p>© 2026 Marine Cadet Platformu.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        // -----------------------------------------

        await sendEmail({
            email: user.email,
            subject: 'Güvenlik Uyarısı: Şifre Sıfırlama Talebi 🔐',
            html: resetHtml // HTML Tasarımı
        });

        res.json({ message: 'Şifre sıfırlama linki e-postanıza gönderildi.' });
    } catch (error) {
        console.error("Forgot Password Error:", error);
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

// @desc    Kullanıcı Profilini Getir
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