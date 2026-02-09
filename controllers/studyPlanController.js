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
        const aiService = require('../utils/aiService');

        // 1. Initial Context
        let context = `KULLANICI: ${user.name} (${user.role})\n`;
        // Minimal initial context to save tokens, let tools fetch details
        if (user.role === 'student') context += `Bölüm: ${user.department}, Ort: ${user.gpa}\n`;
        if (user.role === 'company') context += `Şirket: ${user.name}\n`;

        // 2. First Call to AI
        const aiMessage = await aiService.chatWithAi(message, context);

        // 3. Handle Tool Calls
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            const toolCall = aiMessage.tool_calls[0]; // Handle first tool call for simplicity
            const fnName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            console.log(`[AI Action] Tool: ${fnName}, Args:`, args);

            // --- ACTION: NAVIGATION ---
            if (fnName === 'nav_to') {
                return res.json({
                    reply: `İstediğiniz sayfaya yönlendiriyorum: ${args.path}`,
                    action: { type: 'navigate', path: args.path }
                });
            }

            // --- ACTION: DATA RETRIEVAL ---
            let toolResult = "";

            if (fnName === 'get_my_internships') {
                if (user.role !== 'company') toolResult = "HATA: Bu işlemi sadece şirketler yapabilir.";
                else {
                    const internships = await Internship.find({ company: user._id });
                    toolResult = JSON.stringify(internships.map(i => ({
                        id: i._id, title: i.title, applicants: i.applicants ? i.applicants.length : 0, active: i.isActive
                    })));
                }
            } else if (fnName === 'get_my_applications') {
                if (user.role !== 'student') toolResult = "HATA: Bu işlemi sadece öğrenciler yapabilir.";
                else {
                    // Populate internship details
                    const student = await User.findById(user._id).populate({
                        path: 'applications.internship',
                        select: 'title company',
                        populate: { path: 'company', select: 'name' }
                    });

                    if (!student.applications || student.applications.length === 0) {
                        toolResult = "Henüz hiç başvuru yapılmamış.";
                    } else {
                        // Map and sort by date (assuming we want latest first, but array push order is usually chronological. 
                        // To get latest, we can reverse or rely on insertion order if no timestamp in subdoc)
                        // Actually applications array items usually have _id which has timestamp.
                        const apps = student.applications.map(a => {
                            if (!a.internship) return { title: "Silinmiş İlan", status: a.status };
                            return {
                                title: a.internship.title,
                                company: a.internship.company ? a.internship.company.name : "Bilinmiyor",
                                status: a.status,
                                id: a.internship._id
                            };
                        }).reverse(); // Show newest first
                        toolResult = JSON.stringify(apps);
                    }
                }
            } else if (fnName === 'get_applicants') {
                if (user.role !== 'company') toolResult = "HATA: Yetkisiz işlem.";
                else {
                    const int = await Internship.findById(args.internshipId).populate('applicants.user', 'name surname gpa englishLevel');
                    if (!int) toolResult = "İlan bulunamadı.";
                    else {
                        // Filter for this company
                        if (int.company.toString() !== user._id.toString()) toolResult = "Bu ilan size ait değil.";
                        else {
                            let apps = int.applicants.map(a => ({
                                name: `${a.user.name} ${a.user.surname}`,
                                gpa: a.user.gpa,
                                english: a.user.englishLevel,
                                status: a.status
                            }));
                            // Sort logic
                            if (args.sortBy === 'gpa') apps.sort((a, b) => b.gpa - a.gpa);
                            toolResult = JSON.stringify(apps);
                        }
                    }
                }
            } else if (fnName === 'search_internships') {
                const Internship = require('../models/Internship'); // Ensure Internship model is imported if not already
                const results = await Internship.find({
                    isActive: true,
                    title: { $regex: args.query, $options: 'i' }
                }).limit(5).select('title company location');
                toolResult = JSON.stringify(results);
            } else if (fnName === 'list_active_internships') {
                const Internship = require('../models/Internship');
                const results = await Internship.find({ isActive: true })
                    .populate('company', 'name')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('title company location shipType'); // Select commonly needed fields

                if (results.length === 0) {
                    toolResult = "Şu anda aktif staj ilanı bulunmamaktadır.";
                } else {
                    toolResult = JSON.stringify(results.map(r => ({
                        id: r._id,
                        title: r.title,
                        company: r.company?.name || "Bilinmiyor",
                        location: r.location,
                        ship: r.shipType
                    })));
                }
            } else if (fnName === 'get_top_students') {
                const User = require('../models/User'); // Ensure User model is imported if not already
                const students = await User.find({ role: 'student' })
                    .sort({ successScore: -1 }) // or gpa
                    .limit(5)
                    .select('name surname gpa englishLevel successScore');
                toolResult = JSON.stringify(students);
            }

            // 4. Second Call to AI (Summarize Tool Result)
            // We can't easily pass the full history in this stateless setup without sending it all back and forth.
            // But for this "Query -> Action -> Result" flow, we can just send the result as context.
            const secondResponse = await aiService.chatWithAi(
                `Kullanıcı isteği üzerine '${fnName}' fonksiyonu çalıştırıldı. Sonuçlar: ${toolResult}.\n\n` +
                `GÖREVİN: Bu sonuçları kullanıcıya listele. ` +
                `ÖNEMLİ KURAL: Her staj ilanı veya başvurusu için MUTLAKA şu formatta tıklanabilir link oluştur: "İlan Başlığı [Detayları Gör](/internships/ID)". ` +
                `Eğer sonuçlarda ID varsa link oluşturmamak yasaktır.`,
                context
            );

            // Handle edge case where second response might recursively call tools (avoid loop, just take content)
            // Correction: aiService.chatWithAi returns MESSAGE OBJECT.
            // We need to extract content.
            let finalContent = "";
            if (secondResponse.content) finalContent = secondResponse.content;
            else if (typeof secondResponse === 'string') finalContent = secondResponse; // Mock fallback
            else finalContent = "İşlem tamamlandı ancak yanıt oluşturulamadı.";

            return res.json({ reply: finalContent });

        }

        // No tool called, just return content
        res.json({ reply: aiMessage.content });

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
