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
    slug: { type: String }, // New field for URL-friendly topic name
    lectureContent: { type: String }, // Konu anlatımı metni
    youtubeUrl: { type: String }, // YouTube video URL
    isCompleted: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: true },
    unlockDate: { type: Date }, // When this module becomes accessible
    questions: [questionSchema],
    score: { type: Number, default: 0 }, // Score for this day's quiz
    completedAt: { type: Date } // Timestamp when the day was completed
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
    isActive: { type: Boolean, default: true },
    slug: { type: String, unique: true, index: true, sparse: true }
}, {
    timestamps: true
});

// Pre-save hook to generate unique slug based on student and company names
studyPlanSchema.pre('save', async function () {
    if (this.isNew || !this.slug) {
        try {
            const User = mongoose.model('User');
            // Fetch student and company to get names
            const student = await User.findById(this.student);
            const company = await User.findById(this.targetCompany);

            if (student && company) {
                const { generateSlug } = require('../utils/slugify');
                // Create base slug: "ali-yilmaz-msc-logistics"
                // Assuming company name might be "MSC Logistics"
                let baseSlug = generateSlug(`${student.name}-${company.name}-hazirlik`);

                let slug = baseSlug;
                let counter = 1;

                // Ensure uniqueness
                while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
                    slug = `${baseSlug}-${counter}`;
                    counter++;
                }
                this.slug = slug;
            }
        } catch (error) {
            console.error("Error generating slug for StudyPlan:", error);
            // Fallback logic could be added here if needed
        }
    }
});

const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
module.exports = StudyPlan;
