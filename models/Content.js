const mongoose = require('mongoose');

const contentSchema = mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Hangi hoca yayınladı?
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, required: true, enum: ['Duyuru', 'Belge', 'Ders Notu'] },
    targetAudience: { type: String, default: 'Tüm Öğrenciler' },
    fileName: { type: String },
    fileData: { type: String }, // Base64 verisi için
}, {
    timestamps: true
});

const Content = mongoose.model('Content', contentSchema);
module.exports = Content;