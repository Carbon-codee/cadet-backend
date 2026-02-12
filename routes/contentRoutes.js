const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const Resource = require('../models/Resource');
const { protect, isLecturer } = require('../middleware/authMiddleware');

// @desc    Tüm içerikleri ve kaynakları getir (Birleştirilmiş)
router.get('/', protect, async (req, res) => {
    try {
        // 1. Content verilerini çek
        const contents = await Content.find({})
            .populate('author', 'name title profilePicture department')
            .sort({ createdAt: -1 });

        // 2. Resource verilerini çek
        const resources = await Resource.find({})
            .populate('instructor', 'name title profilePicture department')
            .sort({ createdAt: -1 });

        // 3. Resources'ları Content formatına dönüştür (unified format)
        const transformedResources = resources.map(resource => ({
            _id: resource._id,
            title: resource.title,
            content: resource.description || '',
            type: resource.fileType === 'youtube' ? 'Video' : resource.fileType === 'pdf' ? 'Ders Notu' : 'Belge',
            author: resource.instructor, // instructor field'i author olarak kullan
            createdAt: resource.createdAt,
            // Resource'a özgü alanlar
            isResource: true,
            youtubeUrl: resource.youtubeUrl,
            fileUrl: resource.fileUrl,
            fileType: resource.fileType
        }));

        // 4. İkisini birleştir ve tarihe göre sırala
        const allItems = [...contents, ...transformedResources].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json(allItems);
    } catch (error) {
        console.error('İçerik yükleme hatası:', error);
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

// @desc    Tek bir içeriği getir (ID veya Slug ile)
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const mongoose = require('mongoose');

        let content = null;

        // 1. ID Kontrolü ve Arama
        if (mongoose.Types.ObjectId.isValid(id)) {
            // Önce Content ara
            content = await Content.findById(id).populate('author', 'name title profilePicture department');

            // Bulunamazsa Resource ara (Çünkü listeleme sayfasında Resources da var)
            if (!content) {
                const resource = await Resource.findById(id).populate('instructor', 'name title profilePicture department');
                if (resource) {
                    // Resource bulundu, Content formatına dönüştür
                    content = {
                        _id: resource._id,
                        title: resource.title,
                        content: resource.description || '',
                        type: resource.fileType === 'youtube' ? 'Video' : resource.fileType === 'pdf' ? 'Ders Notu' : 'Belge',
                        author: resource.instructor,
                        createdAt: resource.createdAt,
                        isResource: true,
                        youtubeUrl: resource.youtubeUrl,
                        fileUrl: resource.fileUrl,
                        fileType: resource.fileType
                    };
                }
            }
        } else {
            // Slug ile Arama (Sadece Content modelinde slug var)
            content = await Content.findOne({ slug: id }).populate('author', 'name title profilePicture department');
        }

        if (content) {
            res.json(content);
        } else {
            res.status(404).json({ message: 'İçerik bulunamadı.' });
        }
    } catch (error) {
        console.error("Get Content/Resource Error:", error);
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