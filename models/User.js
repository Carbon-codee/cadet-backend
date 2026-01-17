const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const documentSchema = mongoose.Schema({
    name: String,
    type: { type: String, enum: ['CV', 'Sertifika'] },
    path: String,
});

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    surname: { type: String }, // <-- BU SATIRI EKLE
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'company', 'lecturer'] },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    // --- Öğrenciye Özel Alanlar ---
    department: { type: String },
    classYear: { type: String },
    gpa: { type: Number, default: 0 },
    englishLevel: { type: String, default: 'A1' },
    bio: { type: String, default: '' },
    socialActivities: { type: [String], default: [] },
    documents: { type: [documentSchema], default: [] },
    successScore: { type: Number, default: 0 },
    applications: [
        {
            internship: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Internship'
            },
            status: {
                type: String,
                enum: ['Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi']
            }
        }
    ],
    preferences: {
        shipTypes: { type: [String], default: [] }, // Örn: ['Konteyner', 'Tanker']
        targetCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Hedeflediği Şirketler
    },
    title: { type: String, default: '' },   // Prof. Dr. vb.
    office: { type: String, default: '' },  // D-203 vb.
    // --- Şirkete Özel Alanlar ---
    companyInfo: {
        website: { type: String, default: '' },
        address: { type: String, default: '' },
        about: { type: String, default: '' },
    },

}, { timestamps: true });

// Parolayı kaydetmeden önce şifrele
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Girilen şifreyi veritabanındaki şifreyle karşılaştır
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;