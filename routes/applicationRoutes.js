const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, isStudent } = require('../middleware/authMiddleware');

router.get('/my', protect, isStudent, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'applications.internship', // applications dizisinin içindeki internship alanını doldur
                model: 'Internship', // Hangi model ile doldurulacak
                populate: {
                    path: 'company', // internship'in içindeki company alanını da doldur
                    model: 'User', // Hangi model ile
                    select: 'name' // Sadece 'name' alanını al
                }
            });

        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı" });
        }

        // Silinmiş veya null olan ilanları filtrele
        const validApplications = user.applications.filter(app => app.internship);

        res.json(validApplications);

    } catch (error) {
        console.error("Başvurularım Hatası:", error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

module.exports = router;