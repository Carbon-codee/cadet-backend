const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');

// Token oluşturucu
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'gizli_anahtar', {
        expiresIn: '30d',
    });
};

// @desc    Kullanıcı Kaydı (MAİL ONAYSIZ - DİREKT GİRİŞ)
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'Bu e-posta zaten kayıtlı.' });
        }

        // Kullanıcıyı oluşturuyoruz ve DİREKT ONAYLI (isVerified: true) yapıyoruz.
        const user = await User.create({
            name,
            email,
            password,
            role,
            isVerified: true // <--- ARTIK MAİL BEKLEMEK YOK
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
                message: "Kayıt başarılı! Giriş yapabilirsiniz."
            });
        } else {
            res.status(400).json({ message: 'Geçersiz kullanıcı verisi.' });
        }
    } catch (error) {
        console.error("Kayıt Hatası:", error);
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
            // isVerified kontrolünü kaldırdık veya zaten true olduğu için geçecek

            res.json({
                _id: user._id,
                token: generateToken(user._id),
                name: user.name,
                surname: user.surname,
                email: user.email,
                role: user.role,
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
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// @desc    Kullanıcı Profilini Getir
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

// @desc    Profili Güncelle
// @route   PUT /api/auth/profile/me
router.put('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            Object.assign(user, req.body);
            if (req.body.companyInfo && user.role === 'company') {
                user.companyInfo = { ...user.companyInfo, ...req.body.companyInfo };
            }
            if (req.body.preferences) {
                user.preferences = { ...user.preferences, ...req.body.preferences };
            }
            const updatedUser = await user.save();
            res.json({
                ...updatedUser._doc,
                token: generateToken(updatedUser._id)
            });
        } else {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

module.exports = router;