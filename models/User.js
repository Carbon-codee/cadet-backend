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
    profilePicture: { type: String, default: "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg" },

    // --- Öğrenci Portfolyo Alanları ---
    cvUrl: { type: String }, // PDF URL
    transcriptUrl: { type: String }, // PDF URL
    certificates: [{
        name: { type: String },
        url: { type: String } // PDF/Resim URL
    }],
    // ----------------------------------

    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'company', 'lecturer', 'admin'] },
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
        sector: { type: String },  // <-- BU SATIR MUTLAKA OLMALI!
    },

    // --- ADMIN ONAY VE DOĞRULAMA SİSTEMİ ---
    studentBarcode: { type: String, required: false }, // Register'da zorunlu olacak
    isApproved: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    // --- KVKK Onay Alanları ---
    kvkkApproved: { type: Boolean, default: false },
    kvkkApprovalDate: { type: Date },
    kvkkVersion: { type: String, default: "1.0.0" },
    kvkkIpAddress: { type: String }

}, { timestamps: true });

// Parolayı kaydetmeden önce şifrele
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
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