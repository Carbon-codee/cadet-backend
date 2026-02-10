const mongoose = require('mongoose');

const questionSchema = mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }], // 4 options
    correctAnswer: { type: String, required: true }, // The correct option string
    difficulty: { type: String, enum: ['Kolay', 'Orta', 'Zor'], default: 'Orta' }
});

const dayModuleSchema = mongoose.Schema({
    dayNumber: { type: Number, required: true },
    topic: { type: String, required: true },
    lectureContent: { type: String }, // Konu anlatımı metni
    youtubeUrl: { type: String }, // YouTube video URL
    isCompleted: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: true },
    unlockDate: { type: Date }, // When this module becomes accessible
    questions: [questionSchema],
    score: { type: Number, default: 0 }, // Score for this day's quiz
});

const studyPlanSchema = mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetCompany: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: { type: Date, default: Date.now },
    modules: [dayModuleSchema],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
module.exports = StudyPlan;
