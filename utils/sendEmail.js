const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Transporter ayarları
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // Burada Uygulama Şifresi olmalı
        }
    });

    // Mail detayları
    const message = {
        from: `Cadet Platform <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message
    };

    // Maili gönder ve hatayı yakala
    try {
        const info = await transporter.sendMail(message);
        console.log("Mail başarıyla gönderildi. ID: " + info.messageId);
    } catch (error) {
        console.error("NODEMAILER HATASI:", error); // Terminalde hatayı görmek için
        throw new Error("Email gönderilemedi");
    }
};

module.exports = sendEmail;