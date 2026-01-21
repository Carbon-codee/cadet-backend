const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const { protect, isLecturer } = require('../middleware/authMiddleware');

// @desc    Tüm içerikleri getir
router.get('/', protect, async (req, res) => {
    try {
        const contents = await Content.find({})
            .populate('author', 'name title')
            .sort({ createdAt: -1 });
        res.json(contents);
    } catch (error) {
        res.status(500).json({ message: 'İçerikler alınamadı.' });
    }
});

// @desc    Yeni içerik oluştur
router.post('/', protect, isLecturer, async (req, res) => {
    try {
        const { title, content, type, targetAudience, fileName, fileData } = req.body;

        const newContent = new Content({
            title, content, type, targetAudience, fileName, fileData,
            author: req.user._id
        });

        const savedContent = await newContent.save();
        res.status(201).json(savedContent);
    } catch (error) {
        res.status(500).json({ message: 'İçerik oluşturulamadı: ' + error.message });
    }
});

// @desc    Tek bir içeriği getir
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

// --- EKSİK OLAN GÜNCELLEME ROTASI EKLENDİ ---
// @desc    İçeriği Güncelle
// @route   PUT /api/content/:id
router.put('/:id', protect, isLecturer, async (req, res) => {
    try {
        const { title, content, type, targetAudience, fileName, fileData } = req.body;

        // Önce içeriği bul
        const contentItem = await Content.findById(req.params.id);

        if (contentItem) {
            // Güvenlik: Sadece içeriği oluşturan hoca güncelleyebilir
            if (contentItem.author.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Bu içeriği düzenleme yetkiniz yok.' });
            }

            // Alanları güncelle
            contentItem.title = title || contentItem.title;
            contentItem.content = content || contentItem.content;
            contentItem.type = type || contentItem.type;
            contentItem.targetAudience = targetAudience || contentItem.targetAudience;

            // Dosya değişikliği varsa güncelle, yoksa eskisi kalsın
            // (Frontend boş gönderirse, eğer özellikle silinmediyse backend'de null yapmıyoruz)
            if (fileName !== undefined) {
                contentItem.fileName = fileName;
                contentItem.fileData = fileData;
            }

            const updatedContent = await contentItem.save();
            res.json(updatedContent);
        } else {
            res.status(404).json({ message: 'İçerik bulunamadı.' });
        }
    } catch (error) {
        console.error("Güncelleme hatası:", error);
        res.status(500).json({ message: 'Güncelleme işlemi başarısız.' });
    }
});

// @desc    İçeriği Sil
router.delete('/:id', protect, isLecturer, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);

        if (content) {
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