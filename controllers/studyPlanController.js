const User = require('../models/User');
const Internship = require('../models/Internship');
const StudyPlan = require('../models/StudyPlan');
const slugify = require('slugify');

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
            slug: slugify(finalTopic, { lower: true, strict: true }),
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

        // Check active plans count (Max 3)
        const activePlans = await StudyPlan.find({ student: student._id, isActive: true });
        if (activePlans.length >= 3) {
            return res.status(400).json({
                message: 'Maksimum 3 adet aktif çalışma planınız olabilir. Lütfen yeni bir plan oluşturmadan önce mevcut planlardan birini arşivleyin.',
                needsPlan: false
            });
        }

        // Check if plan for THIS company already exists
        const existingPlanForCompany = activePlans.find(p => p.targetCompany.toString() === targetCompanyId);
        if (existingPlanForCompany) {
            return res.status(200).json({
                message: 'Bu hedef için zaten aktif bir planınız var.',
                needsPlan: true,
                planId: existingPlanForCompany._id
            });
        }

        // 3. Analyze Transcript AND Archived Plans (AI Memory)
        // Grades considered weak: FF, VF, DD, DD+, DC, DC+
        const weakGrades = ['FF', 'VF', 'DD', 'DD+', 'DC', 'DC+'];
        let weakSubjects = [];

        // A. Transcript Analysis
        if (student.transcript && student.transcript.length > 0) {
            weakSubjects = student.transcript
                .filter(record => weakGrades.includes(record.grade))
                .map(record => record.courseName);
        }

        // B. Archived Plan Analysis (AI Memory)
        // Find past plans that are archived (isActive: false)
        const archivedPlans = await StudyPlan.find({ student: student._id, isActive: false });

        let failedTopics = [];
        archivedPlans.forEach(plan => {
            plan.modules.forEach(mod => {
                // Criteria: Completed but Low Score (< 50) OR Incomplete but was unlocked (abandoned)
                const isLowScore = mod.isCompleted && mod.score < 50;
                if (isLowScore) {
                    failedTopics.push(`${mod.topic} (Geçmiş Başarı: %${mod.score})`);
                }
            });
        });

        // Merge weak subjects
        const combinedWeaknesses = [...new Set([...weakSubjects, ...failedTopics])];

        console.log("Transcript Zayıf Dersler:", weakSubjects);
        console.log("Arşivden Gelen Zayıf Konular:", failedTopics);

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
                    weakSubjects: combinedWeaknesses // Use the combined list
                },
                {
                    sector: targetCompany.companyInfo ? targetCompany.companyInfo.sector : "",
                    about: targetCompany.companyInfo ? targetCompany.companyInfo.about : ""
                }
            );

            // Map AI output to Database Schema
            modulesData = curriculum.map((item, index) => ({
                dayNumber: item.day,
                topic: item.topic,
                slug: slugify(item.topic, { lower: true, strict: true }),
                lectureContent: `## ${item.topic}\n\n*Bu içerik öğrencinin profiline özel olarak hazırlanmaktadır. "Derse Başla" butonuna bastığınızda detaylı konu anlatımı yüklenecektir.*`,
                isCompleted: false,
                isLocked: item.day !== 1, // Only Day 1 is unlocked initially
                unlockDate: item.day === 1 ? new Date() : null, // Only Day 1 has initial unlock date
                questions: [] // Questions will be generated when content is loaded
            }));

        } catch (aiError) {
            console.error("AI Curriculum Error (Fallback Used):", aiError);
            modulesData = generateCurriculum(weakSubjects); // Fallback to old hardcoded logic
        }

        // Ensure modules are sorted by dayNumber
        modulesData.sort((a, b) => a.dayNumber - b.dayNumber);

        // Lock all days except the first one (in case fallback was used)
        modulesData = modulesData.map((module, index) => ({
            ...module,
            isLocked: index !== 0,
            unlockDate: index === 0 ? new Date() : null
        }));

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

// @desc    Get current study plans (Array) or specific plan by ID/Slug
// @route   GET /api/study-plan/:slug?
// @access  Private
const getStudyPlan = async (req, res) => {
    try {
        const { slug } = req.params;
        let plan;

        if (slug) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(slug)) {
                plan = await StudyPlan.findOne({ _id: slug });
            } else {
                plan = await StudyPlan.findOne({ slug: slug });
            }

            if (plan && req.user.role === 'student' && plan.student.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Bu planı görüntüleme yetkiniz yok.' });
            }
            if (!plan) return res.status(404).json({ message: 'Çalışma programı bulunamadı.' });
            res.json(plan);

        } else {
            // Default: Get ALL active plans for the Matrix Dashboard (Max 3)
            const activePlans = await StudyPlan.find({ student: req.user._id, isActive: true })
                .populate('targetCompany', 'name')
                .sort({ createdAt: -1 });

            res.json(activePlans);
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// @desc    Submit result for a day
// @route   POST /api/study-plan/submit
// @access  Private
const submitDayResult = async (req, res) => {
    try {
        const { planId, dayNumber, correctCount, correctQuestionIds } = req.body;
        const mongoose = require('mongoose');

        let plan;
        if (mongoose.Types.ObjectId.isValid(planId)) {
            plan = await StudyPlan.findById(planId);
        } else {
            plan = await StudyPlan.findOne({ slug: planId });
        }

        if (!plan) return res.status(404).json({ message: 'Plan bulunamadı' });

        const moduleIndex = plan.modules.findIndex(m => m.dayNumber === dayNumber);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Gün bulunamadı' });

        const module = plan.modules[moduleIndex];

        // RULE 1: Check minimum correct answers (10 required)
        const actualCorrectCount = correctQuestionIds && Array.isArray(correctQuestionIds)
            ? correctQuestionIds.length
            : (correctCount || 0);

        const MIN_CORRECT_REQUIRED = 10;

        if (actualCorrectCount < MIN_CORRECT_REQUIRED) {
            return res.status(400).json({
                message: `Test başarısız! En az ${MIN_CORRECT_REQUIRED} doğru cevap gereklidir. Sizin doğru sayınız: ${actualCorrectCount}. Lütfen testi tekrar çözün.`,
                passed: false,
                correctCount: actualCorrectCount,
                requiredCount: MIN_CORRECT_REQUIRED
            });
        }

        // If already completed, don't allow re-completion
        if (module.isCompleted) {
            return res.status(400).json({ message: 'Bu gün zaten tamamlandı.' });
        }

        // Calculate XP based on Difficulty
        let gainedXp = 0;

        console.log(`[DEBUG] Submitting Day Result for User: ${req.user._id}`);
        console.log(`[DEBUG] correctQuestionIds:`, correctQuestionIds);

        if (correctQuestionIds && Array.isArray(correctQuestionIds)) {
            // New Logic: Dynamic XP based on difficulty
            module.questions.forEach(q => {
                // Ensure IDs are strings for comparison
                const qId = q._id ? q._id.toString() : null;
                if (qId && correctQuestionIds.includes(qId)) {
                    if (q.difficulty === 'Zor') gainedXp += 10;
                    else if (q.difficulty === 'Kolay') gainedXp += 5;
                    else gainedXp += 7; // Orta difficulty
                }
            });
        } else {
            // Fallback Logic
            gainedXp = actualCorrectCount * 5;
        }

        console.log(`[DEBUG] Calculated gainedXp: ${gainedXp}`);

        // RULE 2: Mark current day as complete
        await StudyPlan.findOneAndUpdate(
            { _id: plan._id, "modules.dayNumber": dayNumber },
            {
                $set: {
                    "modules.$.isCompleted": true,
                    "modules.$.score": actualCorrectCount
                }
            }
        );

        // RULE 3: Unlock next day with 20-hour delay
        const nextDayNumber = dayNumber + 1;
        const nextModuleIndex = plan.modules.findIndex(m => m.dayNumber === nextDayNumber);

        if (nextModuleIndex !== -1) {
            const unlockTime = new Date();
            unlockTime.setHours(unlockTime.getHours() + 20); // 20 hours from now

            await StudyPlan.findOneAndUpdate(
                { _id: plan._id, "modules.dayNumber": nextDayNumber },
                {
                    $set: {
                        "modules.$.isLocked": true, // Keep locked until unlockDate
                        "modules.$.unlockDate": unlockTime
                    }
                }
            );

            console.log(`[UNLOCK] Day ${nextDayNumber} will unlock at: ${unlockTime}`);
        }

        // Update User XP atomically to prevent race conditions
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $inc: { xp: gainedXp },
            },
            { new: true }
        );

        console.log(`[DEBUG] User Updated. New XP: ${updatedUser ? updatedUser.xp : 'User Not Found'}`);

        // Simple Level Update
        if (updatedUser) {
            const newLevel = Math.floor(updatedUser.xp / 1000) + 1;
            if (updatedUser.level !== newLevel) {
                await User.findByIdAndUpdate(req.user._id, { level: newLevel });
            }
        }

        res.json({
            message: 'Tebrikler! Gün tamamlandı.',
            passed: true,
            gainedXp,
            totalXp: updatedUser ? updatedUser.xp : 0,
            nextDayUnlockTime: nextModuleIndex !== -1 ? new Date(Date.now() + 20 * 60 * 60 * 1000) : null
        });

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
        // Support both old route /:planId/day/:dayNumber and new /:planId/:lessonSlug
        const planId = req.params.planId;
        const identifier = req.params.lessonSlug || req.params.dayNumber;

        const mongoose = require('mongoose');

        let plan;
        if (mongoose.Types.ObjectId.isValid(planId)) {
            plan = await StudyPlan.findById(planId);
        } else {
            plan = await StudyPlan.findOne({ slug: planId });
        }

        if (!plan) return res.status(404).json({ message: 'Plan bulunamadı' });

        // Security check
        if (req.user.role === 'student' && plan.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Erişim reddedildi.' });
        }

        let module;
        // Check if identifier is strictly a number (dayNumber)
        // Note: slug could be "1-giris", so isNaN check is usually enough if slugs contain letters
        if (!isNaN(identifier)) {
            module = plan.modules.find(m => m.dayNumber == identifier);
        } else {
            module = plan.modules.find(m => m.slug === identifier);
        }

        if (!module) return res.status(404).json({ message: 'Ders modülü bulunamadı.' });

        // Add planId to response so frontend can use it for submission
        const responseModule = module.toObject ? module.toObject() : module;
        responseModule.planId = plan._id; // Ensure consistent ID for submissions
        // Check triggers: Placeholder text, question count low, or explicitly "AI Generated" not present in deep check
        const isPlaceholder = (module.lectureContent.includes("hazırlanmaktadır") || module.lectureContent.includes("detaylarını öğreneceksiniz")) && module.lectureContent.length < 500;

        if (isPlaceholder || module.questions.length < 5) {
            const aiService = require('../utils/aiService');
            const MasterLesson = require('../models/MasterLesson'); // Import here to avoid circular dep issues on top if any

            const isWeak = module.topic.includes("Eksik Konu");

            // Helper: Normalize Turkish text for comparison
            const normalizeTurkish = (text) => {
                return text.toLowerCase()
                    .replace(/ş/g, 's').replace(/ğ/g, 'g')
                    .replace(/ı/g, 'i').replace(/ö/g, 'o')
                    .replace(/ü/g, 'u').replace(/ç/g, 'c');
            };

            // Helper: Extract core words from topic
            const extractCoreWords = (topic) => {
                const normalized = normalizeTurkish(topic);
                // Remove common suffixes and metadata
                const cleaned = normalized
                    .replace(/\s*-\s*(bolum|ozel calisma|eksik konu takviyesi|performans olcumu|giris).*$/i, '')
                    .replace(/[^a-z0-9\s]/gi, '');

                // Remove stop words and split
                const stopWords = ['ve', 'ile', 'icin', 'bir', 'bu', 'su', 'o', 'de', 'da'];
                return cleaned.split(/\s+/)
                    .filter(word => word.length > 2 && !stopWords.includes(word));
            };

            // Helper: Check if two topics are similar based on word overlap
            const areSimilarTopics = (topic1, topic2, threshold = 0.6) => {
                const words1 = extractCoreWords(topic1);
                const words2 = extractCoreWords(topic2);

                if (words1.length === 0 || words2.length === 0) return false;

                // Count matching words
                const matches = words1.filter(w => words2.includes(w)).length;

                // Calculate similarity from both directions
                const similarity1 = matches / words1.length;
                const similarity2 = matches / words2.length;

                // Return true if either direction exceeds threshold
                return similarity1 >= threshold || similarity2 >= threshold;
            };

            // 1. NORMALIZE TOPIC & CHECK MASTER LESSON CACHE (with intelligent fuzzy matching)
            const normalizedTopic = module.topic.trim().toLowerCase();

            // Try exact match first
            let masterLesson = await MasterLesson.findOne({ topic: normalizedTopic });

            // If no exact match, try word-based similarity matching
            if (!masterLesson) {
                const allMasterLessons = await MasterLesson.find({});

                for (const lesson of allMasterLessons) {
                    if (areSimilarTopics(module.topic, lesson.displayTopic || lesson.topic)) {
                        masterLesson = lesson;
                        console.log(`[Cache Similarity Hit] "${lesson.displayTopic}" ≈ "${module.topic}"`);
                        break;
                    }
                }
            }

            // Admin Force Refresh Logic
            const forceRefresh = req.query.refresh === 'true' && req.user.role === 'admin';

            let contentToUse = null;

            if (masterLesson && !forceRefresh) {
                console.log(`[Cache Hit] Found MasterLesson for topic: ${module.topic}`);
                contentToUse = {
                    content: masterLesson.content,
                    questions: masterLesson.questions,
                    youtubeUrl: masterLesson.youtubeUrl
                };
            } else {
                console.log(`[Cache Miss] Generating AI content for topic: ${module.topic} (Refresh: ${forceRefresh})`);

                // 2. AI GENERATION (High Quality + Perfect Video)
                const aiResult = await aiService.generateHighQualityContent(module.topic, isWeak);

                contentToUse = {
                    content: aiResult.content,
                    questions: aiResult.questions,
                    youtubeUrl: aiResult.youtubeUrl
                };

                // 3. SAVE / UPDATE MASTER LESSON CACHE (Upsert)
                try {
                    await MasterLesson.findOneAndUpdate(
                        { topic: normalizedTopic },
                        {
                            topic: normalizedTopic,
                            displayTopic: module.topic,
                            content: contentToUse.content,
                            questions: contentToUse.questions,
                            youtubeUrl: contentToUse.youtubeUrl,
                            language: 'tr',
                            lastUpdated: Date.now()
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`[Cache Save] Updated MasterLesson: ${module.topic}`);
                } catch (dbError) {
                    console.error("MasterLesson Save Error:", dbError.message);
                }
            }

            // 4. UPDATE USER STUDY PLAN
            // 4. UPDATE USER STUDY PLAN
            const updatedPlan = await StudyPlan.findOneAndUpdate(
                { _id: plan._id, "modules.dayNumber": module.dayNumber },
                {
                    $set: {
                        "modules.$.lectureContent": contentToUse.content,
                        "modules.$.questions": contentToUse.questions,
                        "modules.$.youtubeUrl": contentToUse.youtubeUrl
                    }
                },
                { new: true } // Return updated document
            );

            // Get the updated module with _id on questions
            const updatedModule = updatedPlan.modules.find(m => m.dayNumber == module.dayNumber);

            // Use the updated module for response
            const responseObj = updatedModule.toObject ? updatedModule.toObject() : updatedModule;
            responseObj.planId = plan._id;
            return res.json(responseObj);
        }

        const responseObj = module.toObject ? module.toObject() : module;
        responseObj.planId = plan._id;
        res.json(responseObj);
    } catch (error) {
        console.error('İçerik üretiminde hata oluştu:', error);
        res.status(500).json({ message: 'İçerik üretiminde hata oluştu.' });
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
                if (user.role !== 'company' && user.role !== 'admin') {
                    // PRIVACY GUARD: Block students
                    toolResult = "GİZLİLİK UYARISI: Başvuran adayların listesini sadece ilan sahibi şirket yetkilileri görüntüleyebilir.";
                } else {
                    const int = await Internship.findById(args.internshipId).populate('applicants.user', 'name surname gpa englishLevel');
                    if (!int) toolResult = "İlan bulunamadı.";
                    else {
                        // Filter for this company
                        if (user.role !== 'admin' && int.company.toString() !== user._id.toString()) {
                            toolResult = "Bu ilan size ait değil.";
                        } else {
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
                const Internship = require('../models/Internship');
                const results = await Internship.find({
                    isActive: true,
                    title: { $regex: args.query, $options: 'i' }
                })
                    .populate('company', 'name') // ENSURE POPULATE
                    .limit(5)
                    .select('title company location');

                toolResult = JSON.stringify(results.map(r => ({
                    title: r.title,
                    company: r.company?.name || "Bilinmiyor", // Name not ID
                    location: r.location,
                    id: r._id
                })));
            } else if (fnName === 'list_active_internships') {
                const Internship = require('../models/Internship');

                // USER REQUEST FIX: Filter out internships that user has already applied to
                let excludeIds = [];
                if (user.role === 'student' && user.applications && user.applications.length > 0) {
                    // Check if application object is populated or ID string
                    excludeIds = user.applications.map(app => {
                        return (app.internship && app.internship._id) ? app.internship._id : app.internship;
                    });
                }

                const results = await Internship.find({
                    isActive: true,
                    _id: { $nin: excludeIds } // EXCLUDE applied internships
                })
                    .populate('company', 'name')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('title company location shipType'); // Select commonly needed fields

                if (results.length === 0) {
                    toolResult = "Başvurmadığınız yeni bir aktif staj ilanı bulunmamaktadır.";
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
                const User = require('../models/User');
                const students = await User.find({ role: 'student' })
                    .sort({ successScore: -1 }) // or gpa
                    .limit(5)
                    .select('name surname gpa englishLevel successScore xp level'); // Added more fields

                // PRIVACY PROTOCOL (KVKK)
                if (user.role === 'student') {
                    // Students see ANONYMIZED data for others
                    const maskedStudents = students.map((s, idx) => {
                        const isMe = s._id.toString() === user._id.toString();
                        return {
                            rank: idx + 1,
                            name: isMe ? "SİZ (Ben)" : `Aday ${idx + 1}`, // Hide Name
                            score: s.successScore || 0,
                            xp: s.xp || 0,
                            level: s.level || 1,
                            // Hide sensitive info
                            gpa: isMe ? s.gpa : "***",
                            english: isMe ? s.englishLevel : "***"
                        };
                    });
                    toolResult = JSON.stringify(maskedStudents);
                } else {
                    // Companies/Admins see full data
                    toolResult = JSON.stringify(students);
                }
            } else if (fnName === 'get_my_current_study_plan') {
                if (user.role !== 'student') {
                    toolResult = "HATA: Bu özellik sadece öğrenciler içindir.";
                } else {
                    const activePlan = await StudyPlan.findOne({ student: user._id, isActive: true })
                        .populate('targetCompany', 'name');

                    if (!activePlan) {
                        toolResult = "Şu anda aktif bir çalışma planınız bulunmuyor.";
                    } else {
                        const nextModule = activePlan.modules.find(m => !m.isCompleted);
                        if (!nextModule) {
                            toolResult = "Tebrikler! Mevcut çalışma planındaki tüm dersleri tamamladınız.";
                        } else {
                            const companyName = activePlan.targetCompany?.name || "Hedef Şirket";
                            toolResult = JSON.stringify({
                                planName: `${companyName} Hazırlık Planı`,
                                day: nextModule.dayNumber,
                                topic: nextModule.topic,
                                slug: nextModule.slug || nextModule.dayNumber,
                                planId: activePlan._id
                            });
                        }
                    }
                }
            }

            // 4. Second Call to AI (Summarize Tool Result)
            const secondResponse = await aiService.chatWithAi(
                `Kullanıcı isteği üzerine '${fnName}' fonksiyonu çalıştırıldı. Sonuçlar: ${toolResult}.\n\n` +
                `GÖREVİN: Bu sonuçları kullanıcıya en faydalı olacak şekilde sun.\n` +
                `LİNKLER (ÇOK ÖNEMLİ): \n` +
                `- Staj İlanı için: "[Başlık - Şirket](/internships/ID)" (ID varsa)\n` +
                `- Çalışma Planı/Ders için: "[Ders: Konu Başlığı](/study-plan/PLAN_ID/LESSON_SLUG)" (Bu formatı study plan sonuçları için kullan)\n` +
                `- Başvuru/İlan Listesi için: Markdown tablosu veya listesi kullan.\n` +
                `FORMAT: Markdown kullan. Başlıkları **kalın** yap.`,
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

// @desc    Get all cached lessons (Admin)
// @route   GET /api/study-plan/master-lessons
// @access  Private/Admin
const getAllMasterLessons = async (req, res) => {
    try {
        // Basic check for admin role (if needed more strict, use middleware)
        if (req.user.role !== 'admin' && req.user.role !== 'company') {
            return res.status(403).json({ message: 'Yetkisiz işlem' });
        }

        const MasterLesson = require('../models/MasterLesson');
        const lessons = await MasterLesson.find().sort({ lastUpdated: -1 });
        res.json(lessons);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ders havuzu yüklenirken hata oluştu.' });
    }
};

// @desc    Get specific master lesson by ID
// @route   GET /api/study-plan/master-lessons/:id
// @access  Private/Admin
// @desc    Get specific master lesson by ID or Slug
// @route   GET /api/study-plan/master-lessons/:id
// @access  Public (for SEO) or Private
const getMasterLessonById = async (req, res) => {
    try {
        // SEO için public erişim gerekli, admin kontrolü kaldırıldı.
        // if (req.user.role !== 'admin' && req.user.role !== 'company') {
        //     return res.status(403).json({ message: 'Yetkisiz işlem' });
        // }

        const MasterLesson = require('../models/MasterLesson');
        const mongoose = require('mongoose');
        const { id } = req.params;

        let lesson;

        if (mongoose.Types.ObjectId.isValid(id)) {
            lesson = await MasterLesson.findById(id);
        } else {
            lesson = await MasterLesson.findOne({ slug: id });
        }

        if (!lesson) {
            return res.status(404).json({ message: 'Ders bulunamadı' });
        }

        res.json(lesson);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ders yüklenirken hata oluştu.' });
    }
};

// @desc    Get all student plans (Admin)
// @route   GET /api/study-plan/admin/all
// @access  Private/Admin
const getAllStudentPlans = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'company') {
            return res.status(403).json({ message: 'Yetkisiz işlem' });
        }

        const plans = await StudyPlan.find()
            .populate('student', 'name surname email')
            .populate('targetCompany', 'name')
            .sort({ createdAt: -1 });

        res.json(plans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Öğrenci planları yüklenirken hata oluştu.' });
    }
};

// @desc    Delete a specific study plan (Admin)
// @route   DELETE /api/study-plan/admin/:id
// @access  Private/Admin
const deleteStudentPlan = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'company') {
            return res.status(403).json({ message: 'Yetkisiz işlem' });
        }

        const plan = await StudyPlan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({ message: 'Plan bulunamadı' });
        }

        await plan.deleteOne();
        res.json({ message: 'Plan başarıyla silindi' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Plan silinirken hata oluştu.' });
    }
};

// @desc    Get detailed study plan for admin view
// @route   GET /api/study-plan/admin/plan/:id
// @access  Private/Admin
const getStudentPlanForAdmin = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Yetkisiz erişim' });
        }

        const plan = await StudyPlan.findById(req.params.id)
            .populate('student', 'name surname xp level profilePicture email department gpa')
            .populate('targetCompany', 'name sector');

        if (!plan) {
            return res.status(404).json({ message: 'Çalışma planı bulunamadı' });
        }

        res.json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Plan detayları alınırken hata oluştu' });
    }
};

module.exports = {
    checkAndCreatePlan,
    getStudyPlan,
    submitDayResult,
    archiveCurrentPlan,
    getPlanHistory,
    getContentForDay,
    chatWithAi,
    getAllMasterLessons,
    getMasterLessonById,
    getAllStudentPlans,
    deleteStudentPlan,
    getStudentPlanForAdmin
};
