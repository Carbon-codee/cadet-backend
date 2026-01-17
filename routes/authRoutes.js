const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
// Token oluşturucu fonksiyon
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'gizli_anahtar', {
        expiresIn: '30d',
    });
};

// @desc    Kullanıcı Kaydı
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'Bu e-posta zaten kayıtlı.' });

        // Rastgele bir doğrulama tokenı oluştur
        const verificationToken = crypto.randomBytes(20).toString('hex');

        const user = await User.create({
            name, email, password, role,
            verificationToken: verificationToken,
            isVerified: false // Başlangıçta onaysız
        });

        if (user) {
            // Doğrulama Linki (Canlıya geçince burayı kendi site adresin yapacaksın)
            // Şimdilik localhost:5173, deploy edince https://senin-siten.vercel.app olacak
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

            const message = `
                <h1>Cadet Platformuna Hoş Geldin!</h1>
                <p>Hesabını doğrulamak için lütfen aşağıdaki butona tıkla:</p>
                <a href="${verifyUrl}" style="background:#3498db; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Hesabımı Doğrula</a>
                <p>veya linke tıkla: ${verifyUrl}</p>
            `;

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Cadet Hesap Doğrulama',
                    message
                });

                res.status(201).json({
                    message: "Kayıt başarılı! Lütfen e-posta kutunuzu kontrol edip hesabınızı doğrulayın."
                });
            } catch (error) {
                console.error(error);
                // Mail gidemezse kullanıcıyı silmeyelim ama hata dönelim
                res.status(500).json({ message: "Kayıt oldu ama mail gönderilemedi." });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});
// @desc    Kullanıcı Girişi
// @route   POST /api/auth/login
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
                surname: user.surname, // Soyad eklendi
                email: user.email,
                role: user.role,

                // Öğrenci / Akademisyen Alanları
                department: user.department,
                classYear: user.classYear,
                gpa: user.gpa,
                englishLevel: user.englishLevel,
                bio: user.bio,
                socialActivities: user.socialActivities,
                documents: user.documents,
                successScore: user.successScore,

                // Akademisyen Özel
                title: user.title,
                office: user.office,

                // Şirket Özel
                companyInfo: user.companyInfo, // Web sitesi, sektör vb. burada

                // Tercihler
                preferences: user.preferences
            });
            // -------------------------------
        } else {
            res.status(401).json({ message: 'Geçersiz e-posta veya şifre.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
});

// @desc    Kullanıcı Profilini Getir (Token ile)
// @route   GET /api/auth/profile/me
router.get('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// @desc    Profili Güncelle (Token ile)
// @route   PUT /api/auth/profile/me
router.put('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // Gelen tüm alanları güncelle
            Object.assign(user, req.body);

            // İç içe objeler için özel kontrol (Şirket Bilgileri)
            if (req.body.companyInfo && user.role === 'company') {
                user.companyInfo = { ...user.companyInfo, ...req.body.companyInfo };
            }
            // Tercihler
            if (req.body.preferences) {
                user.preferences = { ...user.preferences, ...req.body.preferences };
            }

            const updatedUser = await user.save();

            // Güncel veriyi token ile birlikte geri döndür (Frontend state'i için)
            res.json({
                _id: updatedUser._id,
                token: generateToken(updatedUser._id), // Token'ı yenilemeye gerek yok ama frontend bekliyorsa gönderelim
                name: updatedUser.name,
                surname: updatedUser.surname,
                email: updatedUser.email,
                role: updatedUser.role,
                department: updatedUser.department,
                classYear: updatedUser.classYear,
                gpa: updatedUser.gpa,
                englishLevel: updatedUser.englishLevel,
                bio: updatedUser.bio,
                socialActivities: updatedUser.socialActivities,
                documents: updatedUser.documents,
                successScore: updatedUser.successScore,
                title: updatedUser.title,
                office: updatedUser.office,
                companyInfo: updatedUser.companyInfo,
                preferences: updatedUser.preferences
            });
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    try {
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.status(400).json({ message: "Geçersiz veya süresi dolmuş doğrulama linki." });
        }

        user.isVerified = true;
        user.verificationToken = undefined; // Token'ı temizle
        await user.save();

        res.json({ message: "Hesabınız başarıyla doğrulandı! Şimdi giriş yapabilirsiniz." });
    } catch (error) {
        res.status(500).json({ message: "Doğrulama hatası." });
    }
});

module.exports = router;