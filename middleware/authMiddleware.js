const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Kullanıcının geçerli bir token ile giriş yapıp yapmadığını kontrol eder.
const protect = async (req, res, next) => {
    let token;

    // Token'ın 'Bearer' şemasıyla header'da olup olmadığını kontrol et
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Token'ı header'dan al ('Bearer ' kısmını atla)
            token = req.headers.authorization.split(' ')[1];

            // Token'ı doğrula
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Token'dan gelen ID ile kullanıcıyı veritabanında bul (şifre hariç)
            // Bu kullanıcı bilgisini sonraki tüm rota işlemlerinde kullanabilmek için req objesine ekle
            req.user = await User.findById(decoded.id).select('-password');

            // Her şey yolundaysa, bir sonraki adıma (rotanın kendisine) geç
            next();

        } catch (error) {
            console.error('Token doğrulama hatası:', error);
            return res.status(401).json({ message: 'Yetki yok, token geçersiz.' });
        }
    }

    // Eğer header'da token yoksa
    if (!token) {
        return res.status(401).json({ message: 'Yetki yok, token bulunamadı.' });
    }
};

// Kullanıcının rolünün 'company' olup olmadığını kontrol eder
const isCompany = (req, res, next) => {
    // 'protect' middleware'i daha önce çalıştığı için req.user'ın dolu olduğundan eminiz
    if (req.user && req.user.role === 'company') {
        next();
    } else {
        res.status(403).json({ message: 'Bu işlem için yetkiniz yok, şirket hesabı gereklidir.' });
    }
};

// Kullanıcının rolünün 'student' olup olmadığını kontrol eder
const isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        res.status(403).json({ message: 'Bu işlem için yetkiniz yok, öğrenci hesabı gereklidir.' });
    }
};
// --- YENİ EKLENEN KISIM ---
const isLecturer = (req, res, next) => {
    if (req.user && req.user.role === 'lecturer') {
        next();
    } else {
        res.status(401).json({ message: 'Sadece akademisyenler bu işlemi yapabilir.' });
    }
};

module.exports = { protect, isCompany, isStudent };