const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugify');

const applicantSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    status: {
        type: String,
        required: true,
        enum: ['Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi'],
        default: 'Beklemede'
    }
}, { timestamps: true });

const internshipSchema = mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    slug: { type: String, unique: true, index: true }, // SEO-friendly URL slug
    shipType: { type: String, required: true },
    location: { type: String, required: true },
    startDate: { type: Date, required: true },
    duration: { type: String, required: true },
    salary: { type: Number, required: true, default: 0 },
    description: { type: String, required: true },
    department: { type: String, required: true, enum: ['Güverte', 'Makine'] },
    isActive: { type: Boolean, default: true },
    applicants: [applicantSchema],
}, {
    timestamps: true,
});

// Pre-save hook to generate slug
// Pre-save hook to generate slug
internshipSchema.pre('save', async function () {
    // Generate slug if title is modified or slug is missing
    if (this.isModified('title') || !this.slug) {
        // Use require inside the hook to avoid circular dependency issues if any,
        // though strictly unnecessary here as slugify is simple util.
        const { generateSlug } = require('../utils/slugify');

        let baseSlug = generateSlug(this.title);
        let slug = baseSlug;
        let counter = 1;

        // Ensure uniqueness
        // We use this.constructor to refer to the model being saved
        while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        this.slug = slug;
    }
});

// Model oluşturma
const Internship = mongoose.model('Internship', internshipSchema);

module.exports = Internship;
