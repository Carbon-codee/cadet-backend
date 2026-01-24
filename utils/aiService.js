const Groq = require("groq-sdk");

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

const aiService = {
    generateDailyContent: async (topic, weakSubjectMode) => {
        try {
            const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No API Key configured");

            const groq = new Groq({ apiKey });

            const prompt = `
                Sen uzman bir Denizcilik Eğitmenisin.
                Konu: "${topic}"
                Mod: ${weakSubjectMode ? "Detaylı ve açıklayıcı (Öğrenci bu konuda zayıf)" : "Standart özet"}.
                
                Görevin:
                1. Bu konu hakkında Markdown formatında AKADEMİK, EĞİTİCİ ve SÜRÜKLEYİCİ bir ders notu yaz (En az 800 kelime).
                   - **İTÜ Denizcilik Fakültesi** müfredat standartlarına tam uygun olsun.
                   - Bir denizcilik akademisi hocası gibi anlat.
                   - Gerçek hayattan denizcilik örnekleri (vaka analizleri) ver.
                   - Karmaşık terimleri basit analojilerle açıkla.
                   - Önemli kısımları **kalın** işaretle.

                2. Konuyla ilgili 20 adet YARATICI, ZORLAYICI ve SENARYO BAZLI çoktan seçmeli soru hazırla.
                   - KURALLAR:
                     - "options" listesinde 4 adet şık olsun.
                     - DOĞRU CEVABI (correctAnswer) ŞIKLAR ARASINDA RASTGELE DAĞIT (Hepsi A şıkkı OLMASIN, karıştır).
                     - "correctAnswer" alanı, "options" listesindeki doğru şıkkın TAM METNİ ile BİREBİR AYNI olmalıdır.
                     - Asla sadece A, B, C gibi harf yazma, cevabın kendisini yaz.
                
                Çıktı Formatı SADECE geçerli bir JSON olmalıdır. Başka yazı yazma.
                JSON Formatı:
                {
                    "content": "Markdown ders içeriği...",
                    "questions": [
                        { "questionText": "...", "options": ["Şık 1", "Şık 2", "Şık 3", "Şık 4"], "correctAnswer": "Şık 1" }
                    ]
                }
            `;

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: "mixtral-8x7b-32768", // Current recommended model
                temperature: 0.5,
                response_format: { type: "json_object" }
            });

            const text = chatCompletion.choices[0].message.content;
            console.log("DEBUG: Daily Content Output:", text);

            try {
                let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanedText);
            } catch (e) {
                // Regex fallback
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                throw new Error("JSON Parse failed");
            }

        } catch (error) {
            console.log("AI Generation Failed/Skipped (Using Mock):", error.message);
            return getMockContent(topic);
        }
    },

    chatWithAi: async (message, context = "") => {
        try {
            const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
            console.log("DEBUG: Using GROQ_API_KEY:", apiKey ? (apiKey.substring(0, 5) + "...") : "MISSING");

            if (!apiKey) throw new Error("No API Key configured");

            const groq = new Groq({ apiKey });

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Sen 'Kaptan AI' adında yardımsever, bilge ve profesyonel bir denizcilik asistanısın.
                        
                        GÖREVİN:
                        1. Sen bir 'Platform Asistanı'sın.
                        2. SADECE sana verilen "SİTE BİLGİLERİ" içindeki verilere dayanarak cevap ver.
                        3. Site dışı genel bilgiler sorma veya cevaplama (örn: hava durumu, maç sonucu vb. bilmem de).
                        4. Eğer bir ŞİRKET sana soruyorsa, öğrenci listesinden uygun kriterdeki öğrencileri bul ve getir.
                        5. Eğer bir ÖĞRENCİ soruyorsa, profilindeki notlara ve hedeflediği şirketlere göre tavsiye ver.
                        6. İlanları önerirken: "İlan Adı [İlana Git](/internships/ILAN_ID)" formatını kullanarak butonu satırın sonuna ekle.
                        7. Öğrencileri önerirken: "Öğrenci Adı [Profili Gör](/profile/OGRENCI_ID)" formatını kullanarak butonu ismin hemen yanına ekle.
                        8. Linkleri asla yeni satıra koyma, ilgili maddenin içine göm.
                        
                        ${context ? context : "(Veri yok)"}`
                    },
                    { role: "user", content: message }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.7,
            });

            return chatCompletion.choices[0].message.content;

        } catch (error) {
            console.error("DEBUG: Chat Error Details:", error.message);
            return `(HATA: ${error.message})\n\nGroq API ile bağlantı kurulamadı.`;
        }
    },

    generateStudyCurriculum: async (studentProfile, targetCompanyInfo) => {
        try {
            const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
            if (!apiKey) throw new Error("No API Key configured");

            const groq = new Groq({ apiKey });

            const prompt = `
                Sen uzman bir Denizcilik Kariyer Danışmanısın.
                
                Öğrenci Profili:
                - Genel Ortalaması (GPA): ${studentProfile.gpa}
                - İngilizce Seviyesi: ${studentProfile.englishLevel}
                - Zayıf Olduğu Dersler (Transkript Analizi): ${studentProfile.weakSubjects.join(", ") || "Belirgin bir zayıf ders yok"}
                
                Hedef Şirket Profili:
                - Şirket Sektörü: ${targetCompanyInfo.sector || "Genel Denizcilik"}
                - Şirket Hakkında: ${targetCompanyInfo.about || "Standart uluslararası denizcilik şirketi"}

                GÖREVİN:
                Bu öğrencinin bu şirkete seçilebilmesi için 30 günlük (Gün 1'den Gün 30'a kadar SIRALI), kişiselleştirilmiş bir çalışma müfredatı hazırla.
                
                KURALLAR:
                1. Öğrencinin zayıf olduğu konulara ilk haftalarda ağırlık ver.
                2. Şirketin sektörüne uygun teknik konular ekle (Örn: Tanker ise tanker operasyonları).
                3. İngilizce seviyesi düşükse (B2 altı), her haftaya Denizcilik İngilizcesi ekle.
                4. Kariyer ve mülakat hazırlığı konuları da ekle.
                5. GÜNLER KESİNLİKLE 1'den 30'a KADAR SIRALI OLMALIDIR.
                
                ÇIKTI FORMATI:
                Aşağıdaki gibi bir JSON OBJESİ olmalıdır (ROOT "curriculum" anahtarı olmalı):
                {
                    "curriculum": [
                        { "day": 1, "topic": "Konu Başlığı" },
                        { "day": 2, "topic": "Konu Başlığı" },
                         ...
                    ]
                }
            `;

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.4,
                response_format: { type: "json_object" }
            });

            const text = chatCompletion.choices[0].message.content;
            console.log("DEBUG: Raw AI Curriculum Output:", text); // Log for debugging

            let result;
            try {
                // 1. Try simple clean of markdown
                let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                result = JSON.parse(cleanedText);
            } catch (e) {
                // 2. Try to regex extract the first array [...]
                try {
                    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (arrayMatch) {
                        result = JSON.parse(arrayMatch[0]);
                    } else {
                        // 3. Try finding inside an object
                        const objectMatch = text.match(/\{[\s\S]*\}/);
                        if (objectMatch) {
                            const obj = JSON.parse(objectMatch[0]);
                            result = obj.curriculum || obj.days || obj.schedule || Object.values(obj).find(val => Array.isArray(val));
                        }
                    }
                } catch (e2) {
                    console.error("JSON Parsing Failed completely");
                }
            }

            // Normalize result to array
            if (!result) throw new Error("Could not parse JSON");

            let finalArray = [];
            if (result.curriculum && Array.isArray(result.curriculum)) finalArray = result.curriculum;
            else if (Array.isArray(result)) finalArray = result;
            else if (result.days && Array.isArray(result.days)) finalArray = result.days;
            else if (result.schedule && Array.isArray(result.schedule)) finalArray = result.schedule;
            else {
                // Ensure at least we have something if it's an object with keys "1", "2" etc.
                const values = Object.values(result);
                // Filter extracting only objects that look like days
                const possibleDays = values.filter(v => v && typeof v === 'object' && v.topic);
                if (possibleDays.length > 0) finalArray = possibleDays;
            }

            if (finalArray.length === 0) {
                console.error("AI returned valid JSON but no array found:", result);
                return [{ day: 1, topic: "Genel Denizcilik (AI Plan Ayrıştırılamadı - Lütfen Yeniden Deneyin)" }];
            }

            return finalArray;

        } catch (error) {
            console.error("Curriculum Gen Error:", error.message);
            // Fallback
            return Array.from({ length: 30 }, (_, i) => ({
                day: i + 1,
                topic: `Denizcilik Eğitimi - Gün ${i + 1} (Yedek İçerik)`
            }));
        }
    }
};

module.exports = aiService;
