const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Outlook (Hotmail) SMTP Ayarları
    const transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com", // Outlook sunucusu
        port: 587, // Standart port
        secure: false, // TLS kullan
        auth: {
            user: process.env.EMAIL_USER, // Render'da tanımlayacağız
            pass: process.env.EMAIL_PASS  // Render'da tanımlayacağız
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false // Bazen gereken ek güvenlik ayarı
        }
    });

    const message = {
        from: `Cadet Platform <${process.env.EMAIL_USER}>`, // Gönderen: Outlook adresin
        to: options.email, // Alıcı: Kayıt olan öğrenci
        subject: options.subject,
        html: options.message
    };

    try {
        const info = await transporter.sendMail(message);
        console.log("Mail başarıyla gönderildi. MessageID: " + info.messageId);
    } catch (error) {
        console.error("MAIL GÖNDERME HATASI (Nodemailer):", error);
        throw new Error("Email gönderilemedi");
    }
};

module.exports = sendEmail;