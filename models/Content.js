const mongoose = require('mongoose');

const contentSchema = mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Hangi hoca yayınladı?
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    slug: { type: String, unique: true, index: true, sparse: true }, // SEO-friendly URL
    type: { type: String, required: true, enum: ['Duyuru', 'Belge', 'Ders Notu', 'Video'] },
    targetAudience: { type: String, default: 'Tüm Öğrenciler' },
    fileName: { type: String },
    fileData: { type: String }, // Base64 verisi için
    youtubeUrl: { type: String }, // Opsiyonel YouTube linki
}, {
    timestamps: true
});

// Pre-save hook to generate slug
contentSchema.pre('save', async function () {
    if (this.isModified('title') || !this.slug) {
        const { generateSlug } = require('../utils/slugify');

        let baseSlug = generateSlug(this.title);
        let slug = baseSlug;
        let counter = 1;

        // Ensure uniqueness
        while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        this.slug = slug;
    }
});

const Content = mongoose.model('Content', contentSchema);
module.exports = Content;