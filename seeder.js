const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Internship = require('./models/Internship');

dotenv.config();

// --- AYARLAR ---
const TOTAL_STUDENTS = 100;
const PLACED_STUDENTS = 50; // Yerleşecek öğrenci sayısı
const COMPANIES = [
    "Arkas Holding", "YASA Denizcilik", "Beşiktaş Shipping", "Genel Denizcilik",
    "Kıran Holding", "İnce Denizcilik", "Ciner Ship Management", "Palmali Group",
    "Turkon Line", "Chemlog Shipping"
];
const DEPARTMENTS = ["Güverte", "Makine"];
const CLASSES = ["3. Sınıf", "4. Sınıf"];
const ENGLISH_LEVELS = ["A2", "B1", "B2", "C1"];
const SHIP_TYPES = ["Konteyner", "Ham Petrol Tankeri", "Kimyasal Tanker", "Dökme Yük", "Genel Kargo"];

// Rastgele Veri Üreticileri
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGPA = () => (Math.random() * (4.0 - 2.0) + 2.0).toFixed(2);

const importData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔌 MongoDB Bağlantısı Başarılı.');

        // 1. ESKİ VERİLERİ TEMİZLE
        console.log('🗑️  Eski veriler temizleniyor...');
        await User.deleteMany({ role: { $in: ['company', 'student'] } }); // Hocaları silme
        await Internship.deleteMany({});

        // Sabit şifre (Hız için önceden hash'lenmiş: 123456)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        // 2. ŞİRKETLERİ OLUŞTUR
        console.log('🏢 Şirketler oluşturuluyor...');
        const companyDocs = [];
        for (let name of COMPANIES) {
            companyDocs.push({
                name: name,
                email: `info@${name.toLowerCase().replace(/\s/g, '')}.com`,
                password: hashedPassword,
                role: 'company',
                isVerified: true,
                companyInfo: {
                    website: `www.${name.toLowerCase().replace(/\s/g, '')}.com`,
                    address: 'İstanbul, Türkiye',
                    about: `${name}, sektörün öncü firmalarından biridir.`,
                    sector: 'Deniz Taşımacılığı'
                }
            });
        }
        const createdCompanies = await User.insertMany(companyDocs);

        // 3. İLANLARI OLUŞTUR (Her şirkete 5 ilan)
        console.log('📝 İlanlar oluşturuluyor...');
        let allInternships = [];
        for (let comp of createdCompanies) {
            for (let i = 0; i < 5; i++) {
                allInternships.push({
                    company: comp._id,
                    title: `${comp.name} - ${random(DEPARTMENTS)} Stajyeri`,
                    shipType: random(SHIP_TYPES),
                    location: 'Uzak Yol',
                    startDate: new Date('2026-06-01'),
                    duration: '6 Ay',
                    salary: randomInt(500, 1200),
                    description: 'Uzun dönem stajyer arıyoruz.',
                    department: random(DEPARTMENTS),
                    applicants: []
                });
            }
        }
        const createdInternships = await Internship.insertMany(allInternships);

        // 4. ÖĞRENCİLERİ OLUŞTUR
        console.log('👨‍🎓 Öğrenciler oluşturuluyor...');
        const studentDocs = [];
        const names = ["Ali", "Veli", "Ayşe", "Fatma", "Mehmet", "Zeynep", "Can", "Burak", "Elif", "Deniz", "Cem", "Selin"];
        const surnames = ["Yılmaz", "Demir", "Çelik", "Kaya", "Öztürk", "Aydın", "Yıldız", "Şahin", "Kurt", "Arslan"];

        for (let i = 0; i < TOTAL_STUDENTS; i++) {
            const dept = random(DEPARTMENTS);
            const eng = random(ENGLISH_LEVELS);
            const gpa = randomGPA();

            // Başarı skoru hesapla (Basit simülasyon)
            const score = Math.round((gpa * 20) + (eng === 'C1' ? 20 : eng === 'B2' ? 15 : 10));

            studentDocs.push({
                name: `${random(names)}`,
                surname: `${random(surnames)}`,
                email: `student${i + 1}@itu.edu.tr`,
                password: hashedPassword,
                role: 'student',
                isVerified: true,
                department: dept,
                classYear: random(CLASSES),
                gpa: gpa,
                englishLevel: eng,
                successScore: score,
                applications: []
            });
        }

        // Veritabanına kaydetmeden önce objeleri oluşturuyoruz, aşağıda güncelleyip kaydedeceğiz.
        // Mongoose ile toplu işlem için önce öğrencileri kaydedelim, sonra güncelleyelim.
        const createdStudents = await User.insertMany(studentDocs);

        // 5. BAŞVURULARI VE YERLEŞTİRMELERİ YAP
        console.log('🤝 Başvurular ve yerleştirmeler yapılıyor...');

        // İlk 50 öğrenci YERLEŞSİN (Onaylandı)
        for (let i = 0; i < PLACED_STUDENTS; i++) {
            const student = createdStudents[i];
            const internship = random(createdInternships); // Rastgele bir ilana yerleştir

            // İlana öğrenciyi ekle
            await Internship.findByIdAndUpdate(internship._id, {
                $push: { applicants: { user: student._id, status: 'Onaylandı' } }
            });

            // Öğrenciye ilanı ekle
            await User.findByIdAndUpdate(student._id, {
                $push: { applications: { internship: internship._id, status: 'Onaylandı' } }
            });
        }

        // Kalan 50 öğrenci (25'i başvursun ama Beklemede kalsın, 25'i hiç başvurmasın)
        for (let i = PLACED_STUDENTS; i < PLACED_STUDENTS + 25; i++) {
            const student = createdStudents[i];
            const internship = random(createdInternships);

            await Internship.findByIdAndUpdate(internship._id, {
                $push: { applicants: { user: student._id, status: 'Beklemede' } }
            });

            await User.findByIdAndUpdate(student._id, {
                $push: { applications: { internship: internship._id, status: 'Beklemede' } }
            });
        }

        console.log('✅ VERİ YÜKLEME TAMAMLANDI!');
        console.log(`- ${COMPANIES.length} Şirket oluşturuldu.`);
        console.log(`- ${createdInternships.length} İlan oluşturuldu.`);
        console.log(`- ${createdStudents.length} Öğrenci oluşturuldu.`);
        console.log(`- ${PLACED_STUDENTS} Öğrenci işe yerleşti.`);
        process.exit();

    } catch (error) {
        console.error('Hata:', error);
        process.exit(1);
    }
};

importData();