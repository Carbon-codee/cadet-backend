const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugify');

const masterLessonSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    displayTopic: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        unique: true,
        index: true
    },
    content: {
        type: String,
        required: true
    },
    questions: [{
        questionText: String,
        options: [String],
        correctAnswer: String,
        difficulty: String
    }],
    youtubeUrl: {
        type: String,
        default: ""
    },
    language: {
        type: String,
        default: 'tr'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to generate slug
// Pre-save hook to generate slug
masterLessonSchema.pre('save', async function () {
    if (this.isModified('displayTopic') || !this.slug) {
        const { generateSlug } = require('../utils/slugify');

        let baseSlug = generateSlug(this.displayTopic);
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

// Index for fast lookups
masterLessonSchema.index({ topic: 1 });
masterLessonSchema.index({ slug: 1 });

module.exports = mongoose.model('MasterLesson', masterLessonSchema);

