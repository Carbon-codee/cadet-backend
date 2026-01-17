const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // Sadece bir tane burada
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const userRoutes = require('./routes/userRoutes'); // userRoutes'u da import edelim
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/content', require('./routes/contentRoutes'));
// Ayarları yükle ve veritabanına bağlan
dotenv.config();
connectDB();

const app = express();

// Middleware'ler (Sıralama Önemli)
app.use(cors()); // CORS'u en başa alalım, tüm isteklere izin versin
app.use(express.json()); // Gelen istekleri JSON olarak parse et

// Ana Rota (Test için)
app.get('/', (req, res) => {
    res.send('Cadet API sunucusu çalışıyor...');
});

// API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes); // Daha temiz bir kullanım

const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Sunucu ${PORT} portunda çalışıyor...`));