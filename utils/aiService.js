const OpenAI = require("openai");
const yts = require('yt-search');

// --- HELPER: REAL YOUTUBE SEARCH (GELİŞTİRİLMİŞ & FİLTRELİ) ---
const getPerfectVideo = async (aiGeneratedTopic) => {
    try {
        // Arama terimine 'technical', 'animation', 'lecture' ekleyerek eğitim kalitesini artırıyoruz
        const searchQuery = `${aiGeneratedTopic} maritime technical training lecture animation`;
        console.log(`[YouTube Search] Searching for: ${searchQuery}`);

        const trustedChannels = [
            "Maritime Training", "Seagull", "Videotel", "Wartsila", "Naval Arch",
            "Marine Online", "IMO", "Chief MAKOi", "Casual Navigation",
            "Marine Engineering", "Teikoku Databank", "Alfa Laval", "MAN Energy Solutions",
            "Dr. Oliver", "Steering Mariners", "USCS", "Merchant Navy"
        ];

        const r = await yts(searchQuery);

        // Videoları puanlayarak en iyisini seç
        const bestVideo = r.videos.find(v => {
            const title = v.title.toLowerCase();
            const author = v.author.name.toLowerCase();

            // Güvenilir kanalsa öncelik ver
            const isTrusted = trustedChannels.some(ch => author.includes(ch.toLowerCase()));

            // Çöp videoları (Oyun, şaka, kısa video) engelle
            const blacklist = ['game', 'simulator', 'funny', 'accident', 'facia', 'fail', 'minecraft', 'roblox', 'vlog', 'reaction', 'shorts', 'tiktok', 'ship crash'];
            const isNotTrash = !blacklist.some(w => title.includes(w));

            // Eğitim videosu süresi (3 dk - 60 dk arası ideal, teknik videolar uzun olabilir)
            const isRightDuration = v.seconds > 180 && v.seconds < 3600;

            if (isTrusted) return true; // Güvenilir kanalsa direkt al
            return isNotTrash && isRightDuration;
        });

        if (bestVideo) {
            return bestVideo.url;
        }

        if (r.videos.length > 0) return r.videos[0].url; // En iyi eşleşme

        return "https://www.youtube.com/user/IMOHQ"; // Fallback

    } catch (e) {
        console.error("[YouTube Search] Error:", e.message);
        return "https://www.youtube.com/user/IMOHQ";
    }
};

// --- HELPER: ROBUST JSON PARSER (RETRY MEKANİZMALI) ---
const generateJsonWithRetry = async (openai, modelName, messages, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.8, // Yaratıcılık ve detay için yüksek tutuyoruz
                max_tokens: 4096 // İçeriğin yarıda kesilmemesi için limit
            });

            const text = completion.choices[0].message.content;
            return JSON.parse(text);
        } catch (error) {
            console.error(`AI Attempt ${attempt} Failed:`, error.message);
            if (attempt === maxRetries) throw error;
        }
    }
};

const aiService = {
    // 1. SINIRSIZ İÇERİK OLUŞTURMA (MASTERPIECE CONTENT & 20 SORU)
    generateHighQualityContent: async (topic, weakSubjectMode) => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            // İçerik kalitesi için GPT-4o şart
            const modelName = "gpt-4o";

            // SİSTEM PROMPTU: AI'YA "AKADEMİSYEN & PROFESÖR" ROLÜ VERİYORUZ
            const systemPrompt = `Sen Dünya Denizcilik Üniversitesi'nde (WMU) ders veren kıdemli bir Profesör, Uzak Yol Kaptanı (Master Mariner) ve Başmühendissin (Chief Engineer).

            GÖREVİN:
            1. Verilen konu hakkında, bir denizcilik öğrencisinin o konuyu A'dan Z'ye, tüm teknik detaylarıyla, uluslararası regülasyonlarla ve pratik uygulamalarla öğrenmesini sağlayacak **KAPSAMLI BİR AKADEMİK DERS KİTABI BÖLÜMÜ** yazmak.
            2. Bu konuyla ilgili **KESİNLİKLE VE EKSİKSİZ 20 (YİRMİ) ADET** Sınav Sorusu hazırlamak.

            ASLA YAPMAMAN GEREKENLER:
            - Asla özet geçme.
            - Asla "Genel bilgi budur" deyip bırakma.
            - Asla yüzeysel olma.

            İÇERİK BEKLENTİSİ (SINIRSIZ DETAY):
            1. **Derinlik:** Konuyu en ince ayrıntısına kadar (mikron seviyesinde teknik bilgi, formüller, hesaplamalar, termodinamik döngüler, seyir üçgenleri) anlat.
            2. **Otorite (Regülasyonlar):** Anlatırken sürekli IMO Konvansiyonlarına (SOLAS, MARPOL, STCW, LSA Code, FSS Code, COLREG, ISM) madde madde referans ver (Örn: "SOLAS Ch-II/2 Reg 10.5.2 uyarınca...").
            3. **Gemi Tipi & Operasyon:** Konunun farklı gemi tiplerindeki (Tanker, Dökme, Konteyner, LNG) spesifik uygulamalarını karşılaştır.
            4. **Gerçek Hayat & Tecrübe:** "Sahada/Makine dairesinde işler kitaplardaki gibi yürümez" dediğin noktaları belirt. Pratik ipuçları, "Chief'in Sırları", yaşanmış kaza analizleri (Case Studies) ekle.
            5. **Format:** Markdown'ı sonuna kadar kullan. Tablolar, Uyarı Kutuları (Blockquotes), Kontrol Listeleri (Checklists) ve Adım Adım Prosedürler oluştur.

            SORU STANDARDI (GASM / COC SINAVI):
            - **SAYI:** Tam olarak 20 adet soru olacak.
            - **TÜR:** Sorular ezber değil, **MUHAKEME, KRİZ YÖNETİMİ ve ARIZA TESPİTİ** üzerine olmalı.
            - **ZORLUK:** 
              - 5 Adet KOLAY (Temel Bilgi)
              - 10 Adet ORTA (Operasyonel)
              - 5 Adet ZOR (Yönetimsel/Kriz - Çeldiricili)
            - **ŞIKLAR:** 4 veya 5 şık olsun.

            ÇIKTI FORMATI (JSON):
            {
                "videoSearchTerm": "Konuyla ilgili spesifik teknik animasyon veya ders videosu için İngilizce teknik arama terimi (Örn: 'Marine Diesel Engine Fuel Injector overhaul animation')",
                "content": "Markdown formatında, en az 1500-2500 kelimelik, başlıklar, tablolar ve derin teknik anlatım içeren ders metni.",
                "questions": [
                    { 
                        "questionText": "Senaryo bazlı zor soru...", 
                        "options": ["A", "B", "C", "D"], 
                        "correctAnswer": "Doğru Şık (Tam Metin)",
                        "difficulty": "Zor" // 'Kolay', 'Orta', 'Zor'
                    }
                    ... (Burada toplam 20 obje olmalı)
                ]
            }`;

            const userPrompt = `
            DERS KONUSU: "${topic}"
            
            TALİMAT: Bu konuyu bir Başmühendis veya Kaptanın el kitabı olacak seviyede, teknik verilerle, yasal dayanaklarla ve operasyonel prosedürlerle donatarak anlat. 
            Eğer konu teknikse (Motor, Elektrik vs.) çalışma prensibini, parçalarını, bakım (overhaul) limitlerini ve arıza bulma (troubleshooting) adımlarını detaylandır.
            Eğer konu operasyonel ise (Seyir, Yük vs.) checklistleri, risk analizlerini ve acil durum prosedürlerini ekle.
            Ardından 20 adet GASM standartlarında soruyu ekle.
            `;

            const result = await generateJsonWithRetry(openai, modelName, [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            // Video Bulma
            const videoUrl = await getPerfectVideo(result.videoSearchTerm || topic);
            result.youtubeUrl = videoUrl;

            return result;

        } catch (error) {
            console.error("AI Content Error:", error);
            // Hata olsa bile kullanıcıyı boş döndürme
            return {
                content: `## Sistem Hatası\n\nYüksek kaliteli içerik oluşturulurken bir sorun yaşandı. Lütfen daha sonra tekrar deneyin.\n\n*Hata Kodu: ${error.message}*`,
                questions: [],
                youtubeUrl: "https://www.youtube.com/user/IMOHQ"
            };
        }
    },

    // 2. MÜFREDAT OLUŞTURMA (BÖLÜM DUYARLI & DETAYLI)
    generateStudyCurriculum: async (studentProfile, targetCompanyInfo) => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            const modelName = "gpt-4o";

            // BÖLÜM TESPİTİ (GÜVERTE Mİ MAKİNE Mİ?)
            const dept = studentProfile.department ? studentProfile.department.toLowerCase() : "";
            const isEngine = dept.includes("makine") || dept.includes("engine") || dept.includes("mechanic");

            let roleDescription = "";
            let focusTopics = "";

            if (isEngine) {
                // MAKİNE MÜFREDATI (ENGINE DEPT)
                roleDescription = "Sen tecrübeli bir Başmühendis (Chief Engineer) ve Eğitim Planlamacısısın.";
                focusTopics = `
                Konular KESİNLİKLE "Gemi Makineleri İşletme Mühendisliği" (Engine Dept) müfredatına uygun olmalıdır:
                - Gemi Ana Makineleri (2/4 Zamanlı Dizeller, Yanma, Püskürtme, Yağlama)
                - Gemi Yardımcı Makineleri (Pompalar, Kompresörler, Seperatörler, Evaporatörler)
                - Termodinamik ve Isı Transferi
                - Gemi Elektriği (Alternatörler, Senkronizasyon, Dağıtım, Yüksek Voltaj)
                - Otomasyon ve Kontrol Sistemleri
                - Yakıt ve Yağ Analizleri, Kimyasallar
                - Deniz Hukuku (Makine ile ilgili MARPOL Annex I-VI, SOLAS, ISM)
                - Bakım Tutum (PMS), Overhaul Prosedürleri, Arıza Tespiti
                - Makine Dairesi Simülatörü (ERM) Senaryoları
                `;
            } else {
                // GÜVERTE MÜFREDATI (DECK DEPT)
                roleDescription = "Sen tecrübeli bir Uzak Yol Kaptanı (Master Mariner) ve Eğitim Planlamacısısın.";
                focusTopics = `
                Konular KESİNLİKLE "Deniz Ulaştırma İşletme Mühendisliği" (Deck Dept) müfredatına uygun olmalıdır:
                - Seyir (Navigation) & Elektronik Seyir (ECDIS, Radar/ARPA)
                - Gemi Stabilitesi, Trim ve Draft Survey, Yükleme Hesapları
                - Deniz Hukuku & Uluslararası Sözleşmeler (COLREG, SOLAS, MARPOL, STCW)
                - Gemi Manevrası ve Elleçleme
                - Denizcilik İngilizcesi (SMCP) ve Haberleşme (GMDSS)
                - Meteoroloji ve Oşinografi
                - Köprüüstü Kaynak Yönetimi (BRM)
                - Güvenlik (ISPS) ve Acil Durumlar
                `;
            }

            const systemPrompt = `${roleDescription}
            GÖREVİN: Öğrenciyi hedeflediği şirketin (${targetCompanyInfo.sector}) sınavlarına ve mülakatlarına, ayrıca GASM sınavlarına %100 hazır hale getirecek 60 günlük, profesyonel bir yol haritası çizmek.

            KURALLAR:
            1. **Bölüm:** Öğrenci **${isEngine ? "MAKİNE (ENGINE)" : "GÜVERTE (DECK)"}** sınıfındadır. Konular buna göre, o bölümün en zor ve en kritik derslerinden seçilmelidir.
            2. **Spesifiklik:** Asla genel başlık atma. 
               - "Motorlar" YAZMA -> "2 Zamanlı Dizel Motorlarda Piston Ring Aşınması ve Ölçümü" YAZ.
               - "Seyir" YAZMA -> "Büyük Daire Seyrinde Vertex Noktası Hesabı" YAZ.
            3. **Akış:** Kolaydan zora değil, **Operasyonelden Yönetimsel** seviyeye doğru ilerle.
            4. **Şirket:** Hedef şirket ${targetCompanyInfo.sector} tipindedir. Buna uygun konular ekle (Örn: Tanker ise IGS/COW, Konteyner ise Lashing/Istif).

            ÇIKTI FORMATI (JSON):
            {
                "curriculum": [
                    { "day": 1, "topic": "Dersin Tam Teknik Başlığı" },
                    { "day": 2, "topic": "..." },
                    ... (60 güne kadar)
                ]
            }`;

            const userPrompt = `
            Öğrenci Bölümü: ${studentProfile.department}
            Zayıf Yönleri: ${studentProfile.weakSubjects.join(", ") || "Genel Tekrar"}
            Hedef Şirket: ${targetCompanyInfo.sector} (${targetCompanyInfo.about})
            
            Lütfen "Genel Eğitim" gibi boş dersler oluşturma. Her günün konusu bir kitap bölümü başlığı gibi teknik ve doyurucu olsun. 60 günü doldur.`;

            const result = await generateJsonWithRetry(openai, modelName, [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            let finalArray = result.curriculum || [];

            // Eğer AI 60 günü dolduramazsa, eksikleri kaliteli başlıklarla tamamla
            if (finalArray.length < 60) {
                const missingCount = 60 - finalArray.length;
                for (let i = 0; i < missingCount; i++) {
                    finalArray.push({
                        day: finalArray.length + 1,
                        topic: `İleri Seviye ${isEngine ? 'Makine Operasyonları' : 'Seyir Teknikleri'} ve Vaka Analizi - Bölüm ${i + 1}`
                    });
                }
            }
            return finalArray;

        } catch (error) {
            console.error("Curriculum Error:", error);
            // Fallback: Hata durumunda bile bölüm farkındalığı olsun
            return Array.from({ length: 60 }, (_, i) => ({
                day: i + 1,
                topic: `Denizcilik Eğitimi (Lütfen Yeniden Plan Oluşturun) - Gün ${i + 1}`
            }));
        }
    },

    // 3. CHATBOT (GÜVENLİK VE GİZLİLİK ODAKLI)
    chatWithAi: async (message, context = "") => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            const modelName = "gpt-4o";

            const tools = [
                {
                    type: "function",
                    function: {
                        name: "nav_to",
                        description: "Kullanıcıyı sayfaya yönlendirir.",
                        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_internships",
                        description: "Şirketin ilanlarını listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_applications",
                        description: "Öğrencinin başvurularını listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_applicants",
                        description: "İlana başvuranları listeler. (Sadece Şirket Yetkilisi Erişebilir)",
                        parameters: {
                            type: "object",
                            properties: { internshipId: { type: "string" }, sortBy: { type: "string" } },
                            required: ["internshipId"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "search_internships",
                        description: "Staj ilanı arar.",
                        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "list_active_internships",
                        description: "Aktif staj ilanlarını listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_top_students",
                        description: "Başarılı öğrencileri listeler. (Öğrenci ise isimler gizlenir)",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_current_study_plan",
                        description: "Öğrencinin aktif planını ve derslerini getirir.",
                        parameters: { type: "object", properties: {} }
                    }
                }
            ];

            const systemInstruction = `Sen 'Kaptan AI' adında profesyonel bir denizcilik asistanısın.
            
            GÖREVİN: 
            Kullanıcının sorularına net, doğru ve yardımcı cevaplar vermek.
            
            GİZLİLİK KURALLARI: 
            1. Öğrencilere ASLA başkalarının kişisel verilerini (isim, not, başvuru durumu) gösterme.
            2. Şirketler aday bilgilerini görebilir.
            3. Yanıtlarında Markdown kullan (Kalın, Liste, Tablo).
            
            STİL: 
            Denizcilik terminolojisine hakim, saygılı ve çözüm odaklı ol.`;

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `SİTE BİLGİLERİ:\n${context}\n\nSORU: ${message}` }
                ],
                tools: tools,
                tool_choice: "auto",
            });

            return completion.choices[0].message;

        } catch (error) {
            console.error("Chat Error:", error.message);
            return { content: "Üzgünüm, şu an bağlantı kuramıyorum." };
        }
    }
};

module.exports = aiService;