const mongoose = require('mongoose');

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
});

const internshipSchema = mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    shipType: { type: String, required: true },
    location: { type: String, required: true },
    startDate: { type: Date, required: true },
    duration: { type: String, required: true },
    salary: { type: Number, required: true, default: 0 },
    description: { type: String, required: true },
    department: { type: String, required: true, enum: ['Güverte', 'Makine'] },
    // YENİ: İlanın aktiflik durumu (Varsayılan: Aktif)
    isActive: { type: Boolean, default: true },
    applicants: [applicantSchema],
}, {
    timestamps: true,
});

// Model oluşturma
const Internship = mongoose.model('Internship', internshipSchema);

// KRİTİK NOKTA: Modeli dışa aktar
module.exports = Internship;