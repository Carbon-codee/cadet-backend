const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

dotenv.config();
connectDB();
const app = express();



// İzin verilecek adreslerin listesi
const allowedOrigins = [
    'http://localhost:5173', // Senin bilgisayarın (Test için kalsın)
    'cadet-frontend.vercel.app' // VERCEL LİNKİNİ BURAYA YAPIŞTIR
];

app.use(cors({
    origin: function (origin, callback) {
        // Eğer istek yapan adres izinli listede varsa veya adres yoksa (örn: mobil uygulama)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bu adresten gelen isteklere izin verilmiyor (CORS)'));
        }
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Cadet API sunucusu çalışıyor...');
});

app.use('/api/auth', authRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', require('./routes/userRoutes'));
const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Sunucu ${PORT} portunda çalışıyor...`));