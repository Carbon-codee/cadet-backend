const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const connectDB = require('./config/db');
const helmet = require('helmet');
const morgan = require('morgan'); // YENİ: Logger ekle

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const userRoutes = require('./routes/userRoutes');
const contentRoutes = require('./routes/contentRoutes'); // Yeni content rotasını da ekle

// Ayarları yükle ve DB'ye bağlan
// Ayarları yükle ve DB'ye bağlan
connectDB();

// --- ÖNCE UYGULAMAYI OLUŞTUR ---
const app = express();

// --- SONRA UYGULAMAYI KULLANAN AYARLARI YAP (MIDDLEWARE) ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Artırıldı: PDF yüklemeleri için
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ana Rota
app.get('/', (req, res) => {
    res.send('Cadet API sunucusu çalışıyor...');
});

// API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', require('./routes/adminRoutes')); // YENİ: Admin Rotaları
app.use('/api/messages', require('./routes/messageRoutes')); // Mesajlaşma rotası
app.use('/api/study-plan', require('./routes/studyPlanRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes')); // YENİ: Kaynaklar rotası

const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Sunucu ${PORT} portunda çalışıyor...`));