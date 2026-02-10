const mongoose = require('mongoose');

const masterLessonSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true // Validate uniqueness case-insensitively, but we might store display title separately
    },
    displayTopic: { // Store the original casing for display
        type: String,
        required: true
    },
    content: {
        type: String, // Markdown content
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

// Index for fast lookups
masterLessonSchema.index({ topic: 1 });

module.exports = mongoose.model('MasterLesson', masterLessonSchema);
