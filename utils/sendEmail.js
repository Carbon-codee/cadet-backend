const sgMail = require('@sendgrid/mail');

// API anahtarını ayarla (Bu, Render'daki .env'den gelecek)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
    // Mesajı SendGrid formatına göre hazırla
    const message = {
        to: options.email, // Alıcı: Kayıt olan kullanıcı
        from: {
            name: 'Cadet Platform', // Gönderen Adı
            email: process.env.SENDGRID_FROM_EMAIL // Gönderen Mail (SendGrid'de doğruladığın)
        },
        subject: options.subject,
        html: options.message,
    };

    try {
        await sgMail.send(message);
        console.log(`✅ SendGrid ile mail başarıyla gönderildi: ${options.email}`);
    } catch (error) {
        // Hata olursa detayları terminale yazdır
        console.error('❌ SENDGRID GÖNDERİM HATASI:', error);
        if (error.response) {
            // SendGrid'in döndüğü spesifik hata mesajlarını göster
            console.error(error.response.body);
        }
        // Hatayı yukarıya fırlat ki register fonksiyonu yakalasın
        throw new Error('Email gönderilemedi (SendGrid)');
    }
};

module.exports = sendEmail;