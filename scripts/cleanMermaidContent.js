// MongoDB'deki tüm derslerdeki mermaid bloklarını temizlemek için kullanılabilir.
// Kullanım: node scripts/cleanMermaidContent.js

const mongoose = require('mongoose');
require('dotenv').config();

const MasterLesson = require('../models/MasterLesson');

async function cleanMermaidContent() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB bağlandı...');

        const lessons = await MasterLesson.find({});
        console.log(`Toplam ${lessons.length} ders bulundu.`);

        let updatedCount = 0;

        for (const lesson of lessons) {
            let content = lesson.content;

            // Mermaid bloklarını kaldır
            const hasMermaid = content.includes('```mermaid');

            if (hasMermaid) {
                // Tüm mermaid bloklarını temizle
                content = content.replace(/```mermaid[\s\S]*?```/g, '');

                // Fazla boşlukları temizle
                content = content.replace(/\n\n\n+/g, '\n\n');

                lesson.content = content;
                await lesson.save();

                updatedCount++;
                console.log(`✅ ${lesson.displayTopic} güncellendi`);
            }
        }

        console.log(`\n✨ İşlem tamamlandı: ${updatedCount}/${lessons.length} ders güncellendi.`);
        process.exit(0);
    } catch (error) {
        console.error('Hata:', error);
        process.exit(1);
    }
}

cleanMermaidContent();
