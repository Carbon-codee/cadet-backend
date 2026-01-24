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

    department: { type: String },
    classYear: { type: String },
    gpa: { type: Number, default: 0 },
    englishLevel: { type: String, default: 'A1' },
    bio: { type: String, default: '' },
    socialActivities: { type: [String], default: [] },
    documents: { type: [documentSchema], default: [] },
    transcript: { // YENİ
        type: [{
            courseName: String,
            grade: String
        }],
        default: []
    },
    successScore: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }, // Gamification XP
    level: { type: Number, default: 1 }, // Calculated from XP
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },

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
    currentStatus: {
        type: String,
        enum: ['Staj Arıyor', 'Staj Yapıyor', 'Okulda/Tatilde'],
        default: 'Okulda/Tatilde'
    },
    preferences: {
        shipTypes: { type: [String], default: [] }, // Örn: ['Konteyner', 'Tanker']
        targetCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Hedeflediği Şirketler
    },
    title: { type: String, default: '' },   // Prof. Dr. vb.
    office: { type: String, default: '' },  // D-203 vb.
    // --- Şirkete Özel Alanlar ---
    companyInfo: {
        about: { type: String },
        address: { type: String },
        website: { type: String },
        sector: { type: String }  // <-- BU SATIR MUTLAKA OLMALI!
    }

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