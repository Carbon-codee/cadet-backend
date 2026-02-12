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

const isProduction = process.env.NODE_ENV === 'production';

// --- SONRA UYGULAMAYI KULLANAN AYARLARI YAP (MIDDLEWARE) ---
app.use(cors({
    origin: isProduction
        ? ['https://marine-cadet.com', 'https://www.marine-cadet.com']
        : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));
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
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/study-plan', require('./routes/studyPlanRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));

// SEO: Sitemap route (public, no /api prefix)
const { generateSitemap } = require('./controllers/sitemapController');
app.get('/sitemap.xml', generateSitemap);


const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Sunucu ${PORT} portunda çalışıyor...`));