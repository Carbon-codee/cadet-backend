const mongoose = require('mongoose');

const resourceSchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    fileUrl: { type: String }, // Cloudinary URL (PDF veya Resim)
    fileType: { type: String, enum: ['image', 'pdf', 'youtube', 'other'], default: 'other' },
    youtubeUrl: { type: String },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);
