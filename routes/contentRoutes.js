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
router.get('/:id', protect, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id).populate('author', 'name title');
        if (content) {
            res.json(content);
        } else {
            res.status(404).json({ message: 'İçerik bulunamadı.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// @desc    İçeriği Sil (Sadece Hocalar)
// @route   DELETE /api/content/:id
router.delete('/:id', protect, isLecturer, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);

        if (content) {
            // Sadece kendi içeriğini silebilir
            if (content.author.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Bu içeriği silme yetkiniz yok.' });
            }

            await content.deleteOne();
            res.json({ message: 'İçerik silindi.' });
        } else {
            res.status(404).json({ message: 'İçerik bulunamadı.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Silme işlemi başarısız.' });
    }
});

module.exports = router;