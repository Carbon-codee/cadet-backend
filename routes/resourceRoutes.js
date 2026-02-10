const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const { protect } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../config/cloudinary');

// @desc    Yeni Kaynak Ekle (Dosya veya YouTube)
router.post('/', protect, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'lecturer') {
            return res.status(403).json({ message: "Sadece akademisyenler kaynak ekleyebilir." });
        }

        const { title, description, youtubeUrl, fileType } = req.body;
        let fileUrl = null;

        if (req.file) {
            fileUrl = req.file.path;
        }

        const newResource = new Resource({
            title,
            description,
            fileUrl,
            fileType: fileType || (req.file ? (req.file.mimetype === 'application/pdf' ? 'pdf' : 'image') : 'youtube'),
            youtubeUrl,
            instructor: req.user._id
        });

        await newResource.save();
        res.status(201).json(newResource);

    } catch (error) {
        console.error("Kaynak Ekleme Hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// @desc    Akademisyenin Kaynaklarını Getir
router.get('/instructor/:id', protect, async (req, res) => {
    try {
        const resources = await Resource.find({ instructor: req.params.id }).sort({ createdAt: -1 });
        res.json(resources);
    } catch (error) {
        res.status(500).json({ message: "Kaynaklar getirilemedi." });
    }
});

// @desc    Kaynak Sil
router.delete('/:id', protect, async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) return res.status(404).json({ message: "Kaynak bulunamadı." });

        // Sadece kendi kaynağını silebilir
        if (resource.instructor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Bu işlemi yapmaya yetkiniz yok." });
        }

        // Cloudinary'den dosya silme (Eğer varsa)
        if (resource.fileUrl) {
            // Public ID'yi URL'den çıkar (Basit bir yöntem, config'e göre değişebilir)
            // Örn: .../cadet_avatars/file-123.pdf -> cadet_avatars/file-123
            const parts = resource.fileUrl.split('/');
            const fileName = parts.pop().split('.')[0];
            const publicId = 'cadet_avatars/' + fileName; // Klasör ismiyle beraber
            await cloudinary.uploader.destroy(publicId);
        }

        await resource.deleteOne();
        res.json({ message: "Kaynak silindi." });

    } catch (error) {
        console.error("Kaynak Silme Hatası:", error);
        res.status(500).json({ message: "Silme işlemi başarısız." });
    }
});

module.exports = router;
