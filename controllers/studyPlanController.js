const User = require('../models/User');
const Internship = require('../models/Internship');
const StudyPlan = require('../models/StudyPlan');

// Helper to generate dummy questions (in a real app, uses AI or DB)
const generateQuestions = (topic) => {
    const questions = [];
    for (let i = 1; i <= 20; i++) {
        questions.push({
            questionText: `${topic} ile ilgili soru #${i}?`,
            options: ['A Şıkkı', 'B Şıkkı', 'C Şıkkı', 'D Şıkkı'],
            correctAnswer: 'A Şıkkı'
        });
    }
    return questions;
};

// Helper to generate 60-day curriculum
const generateCurriculum = (weakSubjects = []) => {
    let topics = [
        'Denizcilik İngilizcesi - Temel', 'Seyir Güvenliği', 'Meteoroloji',
        'Gemi İnşa', 'Deniz Hukuku', 'ISM Kod', 'SOLAS & MARPOL',
        'Yük Elleçleme', 'Gemi Manevrası', 'Acil Durum Prosedürleri'
    ];

    // Weak subjects prioritize check
    if (weakSubjects.length > 0) {
        // Remove weak subjects if they already exist in standard list to avoid duplicates (fuzzy match)
        topics = topics.filter(t => !weakSubjects.some(w => t.includes(w) || w.includes(t)));
        // Add weak subjects to the beginning
        topics = [...weakSubjects, ...topics];
    }

    const modules = [];
    for (let i = 0; i < 60; i++) {
        const topicName = topics[i % topics.length];
        // If it's a weak subject, add specific emphasis in title
        const isWeak = weakSubjects.includes(topicName);
        const displayTopic = isWeak ? `${topicName} (Eksik Konu Takviyesi)` : topicName;
        const topicSuffix = isWeak ? ` - Özel Çalışma` : ` - Bölüm ${Math.floor(i / topics.length) + 1}`;

        const finalTopic = displayTopic + topicSuffix;

        modules.push({
            dayNumber: i + 1,
            topic: finalTopic,
            lectureContent: `## ${finalTopic}\n\n${isWeak ? '> **ÖNEMLİ:** Bu konu transkriptinizdeki notlarınıza göre **zayıf** olarak belirlenmiştir. Lütfen ekstra özen gösteriniz.\n\n' : ''}Bu bölümde ${topicName} konusunun detaylarını öğreneceksiniz.\n\n**Anahtar Kavramlar:**\n- Kavram 1: Temel Prensipler\n- Kavram 2: Operasyonel Gereklilikler\n- Kavram 3: Uygulama Standartları\n\nLütfen aşağıdaki testi çözmeden önce notlarınızı dikkatlice okuyun.`,
            isCompleted: false,
            isLocked: false,
            unlockDate: new Date(),
            questions: generateQuestions(finalTopic)
        });
    }
    return modules;
};

// @desc    Check eligibility and create plan if needed
// @route   POST /api/study-plan/check
// @access  Private (Student)
const checkAndCreatePlan = async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        const { targetCompanyId } = req.body;

        if (!targetCompanyId) {
            return res.status(400).json({ message: 'Hedef şirket seçilmedi.' });
        }

        // 1. Get company stats
        // We look for internships by this company, find accepted students, and average their stats.
        // For simplicity, we'll assume we can query Internships directly.

        const internships = await Internship.find({ company: targetCompanyId }).populate('applicants.user');

        let totalGpa = 0;
        let count = 0;
        let englishLevels = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
        let totalEnglish = 0;

        internships.forEach(internship => {
            internship.applicants.forEach(app => {
                if (app.status === 'Onaylandı' && app.user) {
                    totalGpa += app.user.gpa || 0;
                    totalEnglish += englishLevels[app.user.englishLevel] || 1;
                    count++;
                }
            });
        });

        // Default averages if no history
        const avgGpa = count > 0 ? (totalGpa / count) : 3.0; // Default threshold
        const avgEnglishScore = count > 0 ? (totalEnglish / count) : 3; // Default B1

        const studentEnglishScore = englishLevels[student.englishLevel] || 1;

        // Check if plan is needed (Stats calculation kept for reference)
        const needsPlan = (student.gpa < avgGpa) || (studentEnglishScore < avgEnglishScore);

        // Kural Değişikliği: Ortalaması yetse bile eksiklerini kapatması için plan oluşturuyoruz. (User Request)
        /*
        if (!needsPlan) {
            return res.status(200).json({
                message: 'Ortalamanız ve seviyeniz yeterli. Ekstra çalışma programına gerek yok.',
                needsPlan: false
            });
        }
        */

        // Check if plan already exists
        const existingPlan = await StudyPlan.findOne({ student: student._id, isActive: true });
        if (existingPlan) {
            return res.status(200).json({
                message: 'Zaten aktif bir çalışma programınız var.',
                needsPlan: true,
                planId: existingPlan._id
            });
        }

        // 3. Analyze Transcript for Weak Subjects
        // Grades considered weak: FF, VF, DD, DD+, DC, DC+ (and potentially CC if strict)
        // Let's assume failures and low passes (below CC) need work.
        const weakGrades = ['FF', 'VF', 'DD', 'DD+', 'DC', 'DC+'];
        let weakSubjects = [];

        if (student.transcript && student.transcript.length > 0) {
            weakSubjects = student.transcript
                .filter(record => weakGrades.includes(record.grade))
                .map(record => record.courseName);
        }

        console.log("Belirlenen zayıf dersler:", weakSubjects);



        // 4. AI-Based Curriculum Generation
        const aiService = require('../utils/aiService');
        const targetCompany = await User.findById(targetCompanyId);

        let modulesData = [];
        try {
            console.log("AI Müfredat oluşturuluyor...");
            const curriculum = await aiService.generateStudyCurriculum(
                {
                    gpa: student.gpa,
                    englishLevel: student.englishLevel,
                    weakSubjects: weakSubjects
                },
                {
                    sector: targetCompany.companyInfo ? targetCompany.companyInfo.sector : "",
                    about: targetCompany.companyInfo ? targetCompany.companyInfo.about : ""
                }
            );

            // Map AI output to Database Schema
            modulesData = curriculum.map(item => ({
                dayNumber: item.day,
                topic: item.topic,
                lectureContent: `## ${item.topic}\n\n*Bu içerik öğrencinin profiline özel olarak hazırlanmaktadır. "Derse Başla" butonuna bastığınızda detaylı konu anlatımı yüklenecektir.*`,
                isCompleted: false,
                isLocked: false, // For demo purposes, maybe unlock all? Or lock? Let's keep unlocked for testing.
                unlockDate: new Date(),
                questions: [] // Questions will be generated when content is loaded
            }));

        } catch (aiError) {
            console.error("AI Curriculum Error (Fallback Used):", aiError);
            modulesData = generateCurriculum(weakSubjects); // Fallback to old hardcoded logic
        }

        // Ensure modules are sorted by dayNumber
        modulesData.sort((a, b) => a.dayNumber - b.dayNumber);

        const newPlan = await StudyPlan.create({
            student: student._id,
            targetCompany: targetCompanyId,
            modules: modulesData
        });

        res.status(201).json({
            message: 'Çalışma programı oluşturuldu.',
            needsPlan: true,
            planId: newPlan._id,
            avgGpa,
            avgEnglish: Object.keys(englishLevels).find(key => englishLevels[key] === Math.round(avgEnglishScore))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// @desc    Get current study plan
// @route   GET /api/study-plan
// @access  Private
const getStudyPlan = async (req, res) => {
    try {
        const plan = await StudyPlan.findOne({ student: req.user._id, isActive: true });
        if (!plan) {
            return res.status(404).json({ message: 'Aktif çalışma programı bulunamadı.' });
        }
        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// @desc    Submit result for a day
// @route   POST /api/study-plan/submit
// @access  Private
const submitDayResult = async (req, res) => {
    try {
        const { planId, dayNumber, correctCount } = req.body;
        const plan = await StudyPlan.findById(planId);

        if (!plan) return res.status(404).json({ message: 'Plan bulunamadı' });

        const moduleIndex = plan.modules.findIndex(m => m.dayNumber === dayNumber);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Gün bulunamadı' });

        const module = plan.modules[moduleIndex];

        if (module.isCompleted) {
            return res.status(400).json({ message: 'Bu gün zaten tamamlandı.' });
        }

        // 20 questions total. Let's say passing is not required, just completion, but XP depends on score.
        // Or user requirement: "çözdüğü sorulara göre xp kazancak"

        const gainedXp = correctCount * 5; // 5 XP per correct answer. Max 100 XP/day.

        // Optimistic update with findOneAndUpdate to avoid VersionError
        await StudyPlan.findOneAndUpdate(
            { _id: planId, "modules.dayNumber": dayNumber },
            {
                $set: {
                    "modules.$.isCompleted": true,
                    "modules.$.score": correctCount
                }
            }
        );

        // Update User XP atomically to prevent race conditions
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $inc: { xp: gainedXp },
                // Recalculate level based on new XP (approximate level)
                // Note: MongoDB doesn't support calculated fields in update easily without aggregation pipeline.
                // For atomic simplicity, we'll increment XP here. Level can be calculated on read or separate hook.
                // However, if we want to store level:
            },
            { new: true }
        );

        // Simple Level Update (If critical, can be done in pre-save hook or separate atomic set if logic allows)
        // For now, let's just trust XP is source of truth.
        if (updatedUser) {
            const newLevel = Math.floor(updatedUser.xp / 1000) + 1;
            if (updatedUser.level !== newLevel) {
                await User.findByIdAndUpdate(req.user._id, { level: newLevel });
            }
        }

        res.json({ message: 'Tebrikler! Gün tamamlandı.', gainedXp, totalXp: user.xp });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// @desc    Archive current plan
// @route   PUT /api/study-plan/archive
// @access  Private
const archiveCurrentPlan = async (req, res) => {
    try {
        const plan = await StudyPlan.findOne({ student: req.user._id, isActive: true });
        if (plan) {
            await StudyPlan.findOneAndUpdate(
                { _id: plan._id },
                { isActive: false }
            );
            res.json({ message: 'Plan arşivlendi.' });
        } else {
            res.status(404).json({ message: 'Aktif plan yok.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

const getPlanHistory = async (req, res) => {
    try {
        const plans = await StudyPlan.find({
            student: req.user._id,
            isActive: false
        })
            .populate('targetCompany', 'name')
            .sort({ updatedAt: -1 });

        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: 'Geçmiş planlar yüklenirken hata oluştu.' });
    }
};

// @desc    Get content for specific day (Lazy Load / AI Gen)
// @route   GET /api/study-plan/:planId/day/:dayNumber
// @access  Private
const getContentForDay = async (req, res) => {
    try {
        const { planId, dayNumber } = req.params;
        const plan = await StudyPlan.findById(planId);

        if (!plan) return res.status(404).json({ message: 'Plan bulunamadı' });

        // Find module
        const moduleIndex = plan.modules.findIndex(m => m.dayNumber == dayNumber);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Gün bulunamadı' });

        const module = plan.modules[moduleIndex];

        // If content is just a placeholder (or we want to regenerate), generate it
        // We assume "placeholder" if content length is short or distinct flag
        // For this demo, let's say if it doesn't have "AI Generated" or Real content signature
        // Or simply, we can enforce generation if it looks like the default template.

        // Simple check: If questions are dummy (length checking or content)
        // BUT for perfromance, let's just use what we have if it's there. 
        // TO ENABLE AI: We will assume the initial generation was "titles only" or "briefs".

        // Let's re-generate if it's the "default" text we set in generateCurriculum
        // Checks for either the old text or the new text
        const isDefault = (module.lectureContent.includes("detaylarını öğreneceksiniz") || module.lectureContent.includes("özel olarak hazırlanmaktadır")) && module.lectureContent.length < 500;

        if (isDefault) {
            // Generating Real Content
            const aiService = require('../utils/aiService');

            // Determine if weak subject
            const isWeak = module.topic.includes("Eksik Konu");

            const aiResult = await aiService.generateDailyContent(module.topic, isWeak);

            // Optimistic update with findOneAndUpdate to avoid VersionError
            await StudyPlan.findOneAndUpdate(
                { _id: planId, "modules.dayNumber": dayNumber },
                {
                    $set: {
                        "modules.$.lectureContent": aiResult.content,
                        "modules.$.questions": (aiResult.questions && aiResult.questions.length > 0) ? aiResult.questions : []
                    }
                }
            );

            // Update local object specifically for the response
            module.lectureContent = aiResult.content;
            if (aiResult.questions && aiResult.questions.length > 0) {
                module.questions = aiResult.questions;
            }
        }

        res.json(module);

    } catch (error) {
        console.error("Content Gen Error:", error);
        res.status(500).json({ message: 'İçerik getirilemedi.' });
    }
};

const chatWithAi = async (req, res) => {
    try {
        const { message } = req.body;

        const user = await User.findById(req.user._id);

        // 2. Format Context String based on Role
        let context = `SİTE BİLGİLERİ (SADECE BURADAKİ BİLGİLERE GÖRE CEVAP VER, HARİCİ BİLGİ KULLANMA):\n`;
        context += `Aktif Kullanıcı: ${user.name} ${user.surname || ''} (${user.role})\n\n`;

        // --- GLOBAL DATA (Herkese Açık) ---
        // 0. Sınav/Skor Sıralaması (Top 5)
        // --- GLOBAL DATA (Herkese Açık) ---
        // 0. Sınav/Skor Sıralaması (Top 5)
        // DÜZELTME: Doğrudan successScore alanına göre sıralıyoruz. Manuel hesaplama YAPMIYORUZ.
        const topStudents = await User.find({ role: 'student' })
            .select('name surname gpa englishLevel xp successScore _id')
            .sort({ successScore: -1 })
            .limit(5);

        context += "--- EN YÜKSEK SKORLU ÖĞRENCİLER (GENEL SIRALAMA) ---\n";
        context += "NOT: Aşağıdaki 'Başarı Skoru' veritabanından gelen kesin değerdir. Lütfen bu değeri kullanın, kendiniz hesaplama yapmayın.\n";

        topStudents.forEach((s, idx) => {
            const score = s.successScore !== undefined ? s.successScore : 0;
            context += `${idx + 1}. ${s.name} ${s.surname} [Profili Gör](/profile/${s._id}) - Başarı Skoru: ${score} (GPA: ${s.gpa}, İng: ${s.englishLevel})\n`;
        });
        context += "\n";

        // 1. Duyurular/İçerikler
        const Content = require('../models/Content');
        const contents = await Content.find({}).populate('author', 'name title').sort({ createdAt: -1 }).limit(20);
        if (contents.length > 0) {
            context += "--- SON DUYURULAR VE İÇERİKLER ---\n";
            contents.forEach(c => {
                const authorName = c.author ? c.author.name : "Admin";
                // Format: TÜR: BAŞLIK (Yazar: AD) (İçeriği Gör Linki)
                context += `${c.type}: "${c.title}" (Yazar: ${authorName}) [İçeriği Gör](/learning/${c._id}) - Özet: ${c.content.substring(0, 100)}...\n`;
            });
            context += "\n";
        }

        if (user.role === 'company') {
            // --- COMPANY CONTEXT ---
            // 1. Kendi İlanları
            const myInternships = await Internship.find({ company: user._id });
            context += "--- ŞİRKETİN PAYLAŞTIĞI İLANLAR ---\n";
            if (myInternships.length > 0) {
                myInternships.forEach(i => {
                    context += `- İlan: "${i.title}" | Durum: ${i.isActive ? 'Aktif' : 'Pasif'} | Başvuru Sayısı: ${i.applicants.length}\n`;
                });
            } else {
                context += "(Henüz ilan paylaşılmamış)\n";
            }

            // 2. Öğrenci Havuzu (Tam Yetki)
            const students = await User.find({ role: 'student' })
                .select('name surname department gpa englishLevel xp currentStatus transcript');

            context += "\n--- ÖĞRENCİ HAVUZU (ADAYLAR) ---\n";
            if (students.length > 0) {
                students.forEach(s => {
                    // Transkript özet
                    const weakLessons = s.transcript ? s.transcript.filter(t => ['FF', 'VF', 'DD', 'DC'].includes(t.grade)).map(t => t.courseName).join(', ') : '';
                    context += `- ${s.name} ${s.surname} [Profili Gör](/profile/${s._id}): Bölüm: ${s.department} | Ort: ${s.gpa} | İng: ${s.englishLevel} | Durum: ${s.currentStatus} | Zayıf Dersler: ${weakLessons || 'Yok'}\n`;
                });
            }

        } else if (user.role === 'lecturer') {
            // --- LECTURER CONTEXT ---
            // 1. Tüm Öğrenciler ve Detayları
            const students = await User.find({ role: 'student' });
            context += "--- TÜM ÖĞRENCİLERİN DURUMU ---\n";
            for (const s of students) {
                const plan = await StudyPlan.findOne({ student: s._id, isActive: true });
                const planStatus = plan ? `(Planı Var: Gün ${plan.modules.filter(m => m.isCompleted).length}/60)` : '(Planı Yok)';
                context += `- ${s.name} ${s.surname} [Profili Gör](/profile/${s._id}): Ort: ${s.gpa} | İng: ${s.englishLevel} | XP: ${s.xp} | ${planStatus}\n`;
            }

        } else {
            // --- STUDENT CONTEXT ---
            // 1. Aktif Staj İlanları
            const internships = await Internship.find({ isActive: true })
                .populate('company', 'name companyInfo')
                .select('title shipType location duration department company');

            // 2. Kayıtlı Şirketler
            const companies = await User.find({ role: 'company' }).select('name companyInfo');

            context += "--- AKTİF STAJ İLANLARI ---\n";
            internships.forEach(i => {
                const compName = i.company?.name || "Bilinmeyen Şirket";
                context += `- İlan: "${i.title}" (ID: ${i._id}) | Şirket: ${compName} | Gemi: ${i.shipType} | Yer: ${i.location}\n`;
            });

            context += "\n--- ŞİRKETLER ---\n";
            companies.forEach(c => {
                context += `- ${c.name} (${c.companyInfo?.sector || 'Sektör Belirtilmemiş'})\n`;
            });

            // ÖĞRENCİ BAŞKA ÖĞRENCİYİ GÖREMEZ (Privacy)
            context += "\n(Diğer öğrencilerin verilerine erişim yetkiniz yoktur.)\n";
        }

        // Add Current User Profile (For everyone)
        if (user) {
            context += "\n--- MEVCUT KULLANICI PROFİLİ ---\n";
            context += `Rol: ${user.role}\n`;
            context += `Ad Soyad: ${user.name} ${user.surname || ''}\n`;
            if (user.role === 'student') {
                context += `Bölüm: ${user.department}\nGPA: ${user.gpa}\nİngilizce: ${user.englishLevel}\n`;
            } else if (user.role === 'company') {
                context += `Şirket Adı: ${user.name}\nSektör: ${user.companyInfo?.sector}\n`;
            }
        }

        console.log("AI Context Generated (Role: " + user.role + ")");

        const aiService = require('../utils/aiService');
        const reply = await aiService.chatWithAi(message, context);
        res.json({ reply });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ message: "Chat hatası" });
    }
};

module.exports = {
    checkAndCreatePlan,
    getStudyPlan,
    submitDayResult,
    archiveCurrentPlan,
    getPlanHistory,
    getContentForDay,
    chatWithAi
};
