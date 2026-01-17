const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
// --- DÜZELTME: 'isLecturer'i doğru import ediyoruz ---
const { protect, isLecturer } = require('../middleware/authMiddleware');

// @desc    Tüm içerikleri getir (Öğrenciler için)
// @route   GET /api/content
router.get('/', protect, async (req, res) => {
    try {
        const contents = await Content.find({})
            .populate('author', 'name title') // Yazarın adını ve unvanını al
            .sort({ createdAt: -1 });
        res.json(contents);
    } catch (error) {
        res.status(500).json({ message: 'İçerikler alınamadı.' });
    }
});

// @desc    Yeni içerik oluştur (Sadece Hocalar)
// @route   POST /api/content
// --- DÜZELTME: 'isLecturer' middleware'i async handler'dan önce gelmeli ---
router.post('/', protect, isLecturer, async (req, res) => {
    try {
        const { title, content, type, targetAudience, fileName, fileData } = req.body;

        const newContent = new Content({
            title, content, type, targetAudience, fileName, fileData,
            author: req.user._id // Giriş yapmış hoca
        });

        const savedContent = await newContent.save();
        res.status(201).json(savedContent);
    } catch (error) {
        res.status(500).json({ message: 'İçerik oluşturulamadı: ' + error.message });
    }
});

module.exports = router;