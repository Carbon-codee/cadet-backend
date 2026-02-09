const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gizli_anahtar');
            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            res.status(401).json({ message: 'Yetkisiz erişim, token geçersiz.' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Yetkisiz erişim, token yok.' });
    }
};

const isCompany = (req, res, next) => {
    if (req.user && req.user.role === 'company') {
        next();
    } else {
        res.status(401).json({ message: 'Sadece şirketler bu işlemi yapabilir.' });
    }
};

const isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        res.status(401).json({ message: 'Sadece öğrenciler bu işlemi yapabilir.' });
    }
};

const isLecturer = (req, res, next) => {
    if (req.user && req.user.role === 'lecturer') {
        next();
    } else {
        res.status(401).json({ message: 'Sadece akademisyenler bu işlemi yapabilir.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Sadece adminler bu işlemi yapabilir.' });
    }
};

// --- EN KRİTİK KISIM BURASI ---
// Tüm fonksiyonları doğru şekilde export ettiğinden emin ol
module.exports = {
    protect,
    isCompany,
    isStudent,
    isLecturer,
    isAdmin // 'isAdmin' eklendi
};