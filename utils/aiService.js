const OpenAI = require("openai");

// Fallback logic if no API key is provided
const SIMULATED_DELAY = 1500;

const getMockContent = (topic) => {
    return {
        content: `## ${topic} (AI Generated)\n\nBu içerik, yapay zeka servisine erişilemediği için **simüle edilmiştir**.\n\n### Temel Bilgiler\n${topic}, denizcilik dünyasında kritik bir öneme sahiptir. Profesyonel bir zabit olarak bu konunun detaylarına hakim olmanız gerekir.\n\n### Önemli Noktalar\n- **Kural 1:** Daima güvenliği ön planda tutun.\n- **Kural 2:** Uluslararası regülasyonlara (IMO) uyun.\n- **Kural 3:** Ekip iletişimi hayati önem taşır.\n\n> "Deniz sakin olduğunda herkes kaptan kesilir."\n\nLütfen aşağıdaki testi dikkatlice çözünüz.`,
        questions: [
            {
                questionText: `${topic} ile ilgili en önemli öncelik nedir?`,
                options: ["Güvenlik", "Hız", "Maliyet", "Konfor"],
                correctAnswer: "Güvenlik"
            },
            {
                questionText: "Aşağıdakilerden hangisi bu konuda yetkili kurumdur?",
                options: ["IMO", "FIFA", "UNESCO", "NATO"],
                correctAnswer: "IMO"
            },
            {
                questionText: "Acil durumda ilk yapılması gereken nedir?",
                options: ["Sakin kalmak ve prosedürü uygulamak", "Gemiyi terk etmek", "Aileyi aramak", "Yemek yemek"],
                correctAnswer: "Sakin kalmak ve prosedürü uygulamak"
            },
            {
                questionText: "Bu konu hangi sözleşme kapsamındadır?",
                options: ["SOLAS", "Kira Sözleşmesi", "İş Kanunu", "Medeni Kanun"],
                correctAnswer: "SOLAS"
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
    generateDailyContent: async (topic, weakSubjectMode) => {
        try {
            const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : "";
            if (!apiKey || apiKey.startsWith("sk-proj")) {
                // Note: sk-proj indicates a project usage, usually fine, but simple check.
                // Actually we just check if it exists.
            }
            if (!apiKey) throw new Error("No OpenAI API Key configured");

            const openai = new OpenAI({ apiKey: apiKey });
            // Using gpt-4o-mini as requested alternative to gpt-5-mini
            const modelName = "gpt-4o-mini";

            const systemPrompt = `Sen uzman bir Denizcilik Eğitmenisin.
                GÖREVİN:
                1. Verilen konu hakkında Markdown formatında ÇOK DETAYLI, AKADEMİK ve KAPSAMLI bir ders notu yaz.
                   - **HEDEF KELİME SAYISI:** EN AZ 1500 KELİME OLMALIDIR.
                   - **İTÜ Denizcilik Fakültesi** müfredat standartlarına tam uygun olsun.
                   - Bir denizcilik akademisi hocası gibi anlat.
                   - Gerçek hayattan denizcilik örnekleri (vaka analizleri) ver.
                   - Karmaşık terimleri basit analojilerle açıkla.
                   - Önemli kısımları **kalın** işaretle.

                2. Konuyla ilgili TAM OLARAK 20 ADET (Daha az olamaz) YARATICI, ZORLAYICI ve SENARYO BAZLI çoktan seçmeli soru hazırla.
                   - KURALLAR:
                     - "options" listesinde 4 adet şık olsun.
                     - DOĞRU CEVABI (correctAnswer) ŞIKLAR ARASINDA RASTGELE DAĞIT (Hepsi A şıkkı OLMASIN, karıştır).
                     - "correctAnswer" alanı, "options" listesindeki doğru şıkkın TAM METNİ ile BİREBİR AYNI olmalıdır.
                     - Asla sadece A, B, C gibi harf yazma, cevabın kendisini yaz.
                
                Çıktı Formatı SADECE geçerli bir JSON olmalıdır.
                JSON Formatı:
                {
                    "content": "Markdown ders içeriği...",
                    "questions": [
                        { "questionText": "...", "options": ["Şık 1", "Şık 2", "Şık 3", "Şık 4"], "correctAnswer": "Şık 1" }
                    ]
                }
            `;

            const userPrompt = `Konu: "${topic}"
            Mod: ${weakSubjectMode ? "Detaylı ve açıklayıcı (Öğrenci bu konuda zayıf)" : "Standart özet"}.`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            return await generateJsonWithRetry(openai, modelName, messages);

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
            7. Normal cevap verirken Markdown kullan ve listeleri düzenli tut.`;

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
                - Zayıf Olduğu Dersler (Transkript Analizi): ${studentProfile.weakSubjects.join(", ") || "Belirgin bir zayıf ders yok"}
                
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
