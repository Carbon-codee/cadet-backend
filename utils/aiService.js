const OpenAI = require("openai");
const yts = require('yt-search');

// Fallback logic if no API key is provided
const SIMULATED_DELAY = 1500;

// --- HELPER: REAL YOUTUBE SEARCH WITH QUALITY FILTER ---
const getPerfectVideo = async (aiGeneratedTopic) => {
    try {
        // 1. AI'dan gelen çok spesifik arama terimi
        const searchQuery = `${aiGeneratedTopic} technical training maritime lecture`;
        console.log(`[YouTube Search] Searching for: ${searchQuery}`);

        // 2. Güvenilir kanallar (Bunlardan gelirse yapışıyoruz)
        const trustedChannels = [
            "Maritime Training",
            "Seagull",
            "Videotel",
            "Wartsila",
            "Naval Arch",
            "Marine Online",
            "IMO"
        ];

        const r = await yts(searchQuery);

        // 3. Videoları puanlayarak filtrele
        const bestVideo = r.videos.find(v => {
            const title = v.title.toLowerCase();
            const author = v.author.name.toLowerCase();

            // Şirket veya Eğitim kanalıysa +10 puan (Güvenilir kanal kontrolü)
            const isTrusted = trustedChannels.some(ch => author.includes(ch.toLowerCase()));

            // Çöp videoları engelle
            const blacklist = ['game', 'simulator', 'funny', 'accident', 'facia', 'minecraft', 'roblox', 'vlog', 'reaction', 'shorts'];
            const isNotTrash = !blacklist.some(w => title.includes(w));

            // Eğitim videosu genelde 4-20 dk olur (240 - 1200 sn)
            // Ancak güvendiğimiz kanalların kısa/uzun videoları da değerlidir.
            const isRightDuration = v.seconds > 240 && v.seconds < 1200;

            // Güvenilir kanalsa süreye bile bakmayabiliriz ama yine de çok kısa olmasın (> 2 dk)
            if (isTrusted && v.seconds > 120) return true;

            return isNotTrash && isRightDuration;
        });

        if (bestVideo) {
            console.log(`[YouTube Search] Found PERFECT video: ${bestVideo.title} from ${bestVideo.author.name}`);
            return bestVideo.url;
        }

        // Fallback: Return top result if nothing perfect found (better than nothing)
        // But still filter for obvious trash
        if (r.videos.length > 0) {
            console.log(`[YouTube Search] Perfect match not found, using top result.`);
            return r.videos[0].url;
        }

        return "https://www.youtube.com/user/IMOHQ";

    } catch (e) {
        console.error("[YouTube Search] Error:", e.message);
        return "https://www.youtube.com/user/IMOHQ";
    }
};

const getMockContent = (topic) => {
    return {
        youtubeUrl: "https://www.youtube.com/watch?v=txs1L_dYJ9A", // Default fallback
        content: `## ${topic} (AI Generated)\n\nBu içerik, yapay zeka servisine erişilemediği için **simüle edilmiştir**.\n\n### Temel Bilgiler\n${topic}, denizcilik dünyasında kritik bir öneme sahiptir. Profesyonel bir zabit olarak bu konunun detaylarına hakim olmanız gerekir.\n\n### Önemli Noktalar\n- **Kural 1:** Daima güvenliği ön planda tutun.\n- **Kural 2:** Uluslararası regülasyonlara (IMO) uyun.\n- **Kural 3:** Ekip iletişimi hayati önem taşır.\n\n> "Deniz sakin olduğunda herkes kaptan kesilir."\n\nLütfen aşağıdaki testi dikkatlice çözünüz.`,
        questions: [
            {
                questionText: `${topic} ile ilgili en önemli öncelik nedir?`,
                options: ["Güvenlik", "Hız", "Maliyet", "Konfor"],
                correctAnswer: "Güvenlik",
                difficulty: "Kolay"
            },
            {
                questionText: "Aşağıdakilerden hangisi bu konuda yetkili kurumdur?",
                options: ["IMO", "FIFA", "UNESCO", "NATO"],
                correctAnswer: "IMO",
                difficulty: "Kolay"
            },
            {
                questionText: "Acil durumda ilk yapılması gereken nedir?",
                options: ["Sakin kalmak ve prosedürü uygulamak", "Gemiyi terk etmek", "Aileyi aramak", "Yemek yemek"],
                correctAnswer: "Sakin kalmak ve prosedürü uygulamak",
                difficulty: "Orta"
            },
            {
                questionText: "Bu konu hangi sözleşme kapsamındadır?",
                options: ["SOLAS", "Kira Sözleşmesi", "İş Kanunu", "Medeni Kanun"],
                correctAnswer: "SOLAS",
                difficulty: "Orta"
            }
        ]
    };
};

// --- HELPER: ROBUST JSON PARSER WITH RETRY ---
const generateJsonWithRetry = async (openai, modelName, messages, maxRetries = 3) => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`[AI Retry] JSON parsing failed, retrying (${attempt}/${maxRetries})...`);
            }

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: messages,
                response_format: { type: "json_object" }, // Enforce JSON mode
            });

            const text = completion.choices[0].message.content;

            // 1. Basic Cleanup (Should be clean JSON from OpenAI usually)
            let cleanedText = text.trim();

            // 2. Try Parsing directly
            try {
                return JSON.parse(cleanedText);
            } catch (parseError) {
                throw new Error(`JSON Parse Error: ${parseError.message}`);
            }

        } catch (error) {
            lastError = error;
            console.error(`AI Attempt ${attempt} Failed:`, error.message);
        }
    }

    throw lastError || new Error("AI Generation failed after max retries");
};


const aiService = {
    generateHighQualityContent: async (topic, weakSubjectMode) => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            // Using gpt-4o as requested for high quality
            const modelName = "gpt-4o";

            // SYSTEM PROMPT - Youtube URL removed from AI tasks
            const systemPrompt = `Sen, Uluslararası Denizcilik Örgütü (IMO) standartlarına hakim, STCW sertifikalı uzman bir Denizcilik Eğitmenisin.
                
                GÖREVİN:
                1. "videoSearchTerm": Bu konuyla ilgili EN İYİ YouTube videosunu bulmamızı sağlayacak İNGİLİZCE teknik arama terimi.
                   - Örnek: "Centrifugal Pump Overhaust" veya "Colreg Rule 19 explanation".
                   - Sadece konuyu değil, ne aradığını belirten teknik bir terim olsun.

                2. "content": Verilen konu hakkında Markdown formatında AKADEMİK, TEKNİK ve DOĞRUDAN STCW MÜFREDATINA UYGUN ders notları hazırla.
                   - **HEDEF:** En az 1500 kelime, derinlemesine teknik bilgi.
                   - Yüzeysel geçme, detaylara in (Örn: Pompa karakteristikleri, yasal dayanaklar, formüller).
                   - Gerçek hayattan kaza raporları veya vaka analizleri (Case Studies) ekle.
                   - Markdown formatını zengin kullan: 
                     * Başlıklar (##, ###)
                     * Madde işaretli listeler
                     * Numaralı listeler
                     * Tablolar
                     * Alıntılar (>)
                     * Kalın ve italik vurgular
                   - **ÖNEMLİ:** Mermaid diyagramları KULLANMA. Bunun yerine süreçleri madde işaretli veya numaralı listelerle açıkla.
                   - Karmaşık verileri tablolarla sun.

                3. "questions": TAM OLARAK 20 ADET Özgün Soru Hazırla.
                   - Sorular Bloom Taksonomisi'ne göre dağıtılmalı:
                     - %30 Kolay (Hatırlama/Bilgi)
                     - %40 Orta (Kavrama/Uygulama)
                     - %30 Zor (Analiz/Değerlendirme - Vaka bazlı)
                   - Şıkları (A, B, C, D) rastgele dağıt.
                   - Her soru için "difficulty" alanını belirt: 'Kolay', 'Orta', 'Zor'.

                Çıktı Formatı SADECE geçerli bir JSON olmalıdır:
                {
                    "videoSearchTerm": "Technical English Search Term",
                    "content": "# Konu Başlığı\\n\\n## Giriş...",
                    "questions": [
                        { 
                            "questionText": "Soru metni...", 
                            "options": ["Şık 1", "Şık 2", "Şık 3", "Şık 4"], 
                            "correctAnswer": "Şık 1" (Doğru şıkkın tam metni),
                            "difficulty": "Zor"
                        }
                    ]
                }
            `;

            const userPrompt = `Konu: "${topic}"
            Mod: ${weakSubjectMode ? "Detaylı ve açıklayıcı (Öğrenci bu konuda zayıf, ekstra örnekler ver)" : "Profesyonel teknik anlatım"}.
            Lütfen içerik, teknik arama terimi ve soruları eksiksiz üret.`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            // 1. Generate Content from AI
            const result = await generateJsonWithRetry(openai, modelName, messages);

            // 2. Fetch Real YouTube Video (Independent Step)
            // Use the AI-generated specific search term, or fallback to topic
            const searchTerm = result.videoSearchTerm || topic;
            const realVideoUrl = await getPerfectVideo(searchTerm);

            // 3. Attach Video URL to Result
            if (realVideoUrl) {
                result.youtubeUrl = realVideoUrl;
            } else {
                // Fallback to a generic maritime channel if search fails
                result.youtubeUrl = "https://www.youtube.com/watch?v=txs1L_dYJ9A";
            }

            return result;

        } catch (error) {
            console.log("AI Generation Failed/Skipped (Using Mock):", error.message);
            return getMockContent(topic);
        }
    },

    chatWithAi: async (message, context = "") => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            const modelName = "gpt-4o-mini";

            const tools = [
                {
                    type: "function",
                    function: {
                        name: "nav_to",
                        description: "Kullanıcıyı uygulamanın içinde belirli bir sayfaya yönlendirir. Örneğin 'ilanlara git', 'profilime git' dendiğinde kullanılır.",
                        parameters: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: "Gidilecek URL yolu (Örn: '/internships', '/profile', '/company/my-internships')"
                                }
                            },
                            required: ["path"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_internships",
                        description: "Şirketin kendi oluşturduğu staj ilanlarını listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_applications",
                        description: "Öğrencinin kendi yaptığı staj başvurularını listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_applicants",
                        description: "Belirli bir staj ilanına başvuran öğrencileri getirir.",
                        parameters: {
                            type: "object",
                            properties: {
                                internshipId: { type: "string", description: "İlanın veritabanı ID'si" },
                                sortBy: { type: "string", enum: ["gpa", "english", "date"], description: "Sıralama kriteri" }
                            },
                            required: ["internshipId"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "search_internships",
                        description: "Staj ilanlarında belirli bir kelimeye göre arama yapar.",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Aranacak kelime (pozisyon, şirket adı vs.)" }
                            },
                            required: ["query"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "list_active_internships",
                        description: "Sistemdeki tüm aktif staj ilanlarını listeler. Kullanıcı genel olarak 'ilan var mı', 'stajları göster' dediğinde kullanılır.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_top_students",
                        description: "Başarı puanı en yüksek öğrencileri listeler.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_my_current_study_plan",
                        description: "Öğrencinin aktif çalışma planını ve bugünkü dersini getirir. 'Bugün ne çalışmalıyım?', 'Sırada ne var?' sorularında kullanılır.",
                        parameters: { type: "object", properties: {} }
                    }
                }
            ];

            const systemInstruction = `Sen 'Kaptan AI' adında yardımsever, bilge ve profesyonel bir denizcilik asistanısın.
            
            GÖREVİN:
            1. Sen bir 'Platform Asistanı'sın.
            2. Sana verilen "SİTE BİLGİLERİ"ni kullanabilirsin.
            3. Site dışı genel bilgileri (hava durumu vs) cevaplama.
            4. Eğer kullanıcının isteğini yerine getirmek için bir FONKSİYON (Tool) varsa, onu çağırmaktan çekinme.
            5. Özellikle "git", "aç", "yönlendir" gibi komutlarda 'nav_to' fonksiyonunu kullan.
            6. "Başvuruları göster", "adayları listele" gibi durumlarda ilgili veri fonksiyonunu kullan.
            7. Normal cevap verirken Markdown kullan ve listeleri düzenli tut.
            
            GİZLİLİK VE KVKK (ÇOK ÖNEMLİ):
            1. Öğrencilere ASLA ve ASLA diğer öğrencilerin kişisel verilerini (GPA, Transkript, Dil Seviyesi, İsim Soyisim vb.) gösterme.
            2. Öğrenciler sadece kendi bilgilerini görebilir.
            3. Eğer bir öğrenci sıralama veya en iyiler listesini isterse, 'get_top_students' fonksiyonunu çağırabilirsin, ancak dönen veride diğer öğrencilerin isimleri gizlenmiş (anonim) olacaktır.
            4. Şirketler ise işe alım süreçlerini yönetmek için aday bilgilerine erişebilir.`;

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `SİTE BİLGİLERİ:\n${context ? context : "(Veri yok)"}\n\nKullanıcı Sorusu: ${message}` }
                ],
                tools: tools,
                tool_choice: "auto",
            });

            // Return the full message object (content + tool_calls)
            return completion.choices[0].message;

        } catch (error) {
            console.error("DEBUG: Chat Error Details:", error.message);
            return { content: `(HATA: ${error.message})\n\nOpenAI API ile bağlantı kurulamadı.` };
        }
    },

    generateStudyCurriculum: async (studentProfile, targetCompanyInfo) => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            const modelName = "gpt-4o-mini";

            const systemPrompt = `Sen uzman bir Denizcilik Kariyer Danışmanısın.
                GÖREVİN:
                Bir öğrencinin hedef şirkete seçilebilmesi için 60 günlük (Gün 1'den Gün 60'a kadar SIRALI), kişiselleştirilmiş bir çalışma müfredatı hazırla.
                
                KURALLAR:
                1. Öğrencinin zayıf olduğu konulara ilk haftalarda ağırlık ver.
                2. Şirketin sektörüne uygun teknik konular ekle (Örn: Tanker ise tanker operasyonları).
                3. İngilizce seviyesi düşükse (B2 altı), her haftaya Denizcilik İngilizcesi ekle.
                4. Kariyer ve mülakat hazırlığı konuları da ekle.
                5. GÜNLER KESİNLİKLE 1'den 60'a KADAR SIRALI OLMALIDIR.

                ÇIKTI FORMATI:
                SADECE geçerli bir JSON OBJESİ olmalıdır. 
                Root "curriculum" anahtarı olmalı:
                {
                    "curriculum": [
                        { "day": 1, "topic": "Konu Başlığı" },
                        { "day": 2, "topic": "Konu Başlığı" },
                         ...
                    ]
                }
            `;

            const userPrompt = `
                Öğrenci Profili:
                - Genel Ortalaması (GPA): ${studentProfile.gpa}
                - İngilizce Seviyesi: ${studentProfile.englishLevel}
                - Zayıf Olduğu Konular (Transkript ve Arşiv Analizi): ${studentProfile.weakSubjects.join(", ") || "Belirgin bir eksik konu yok"}
                
                Hedef Şirket Profili:
                - Şirket Sektörü: ${targetCompanyInfo.sector || "Genel Denizcilik"}
                - Şirket Hakkında: ${targetCompanyInfo.about || "Standart uluslararası denizcilik şirketi"}
            `;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            const resultJson = await generateJsonWithRetry(openai, modelName, messages);

            // Normalize result to array
            if (!resultJson) throw new Error("Could not parse JSON");

            let finalArray = [];
            if (resultJson.curriculum && Array.isArray(resultJson.curriculum)) finalArray = resultJson.curriculum;
            else if (Array.isArray(resultJson)) finalArray = resultJson;
            else {
                // Trying to find array in object values
                const values = Object.values(resultJson);
                const possibleArray = values.find(v => Array.isArray(v));
                if (possibleArray) finalArray = possibleArray;
            }

            if (finalArray.length === 0) {
                return [{ day: 1, topic: "Genel Denizcilik (AI Plan Ayrıştırılamadı - Lütfen Yeniden Deneyin)" }];
            }

            return finalArray;

        } catch (error) {
            console.error("Curriculum Gen Error:", error.message);
            // Fallback
            return Array.from({ length: 60 }, (_, i) => ({
                day: i + 1,
                topic: `Denizcilik Eğitimi - Gün ${i + 1} (Yedek İçerik)`
            }));
        }
    }
};

module.exports = aiService;
