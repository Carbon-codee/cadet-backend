const sgMail = require('@sendgrid/mail');

// API anahtarını ayarla
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
    const message = {
        to: options.email,
        from: {
            name: 'Cadet Platform',
            email: process.env.SENDGRID_FROM_EMAIL // Doğruladığın mail adresi
        },
        subject: options.subject,
        html: options.message,
    };

    try {
        await sgMail.send(message);
        console.log('SendGrid ile mail başarıyla gönderildi.');
    } catch (error) {
        console.error('SENDGRID HATASI:', error);
        if (error.response) {
            console.error(error.response.body); // Hatanın detayını göster
        }
        throw new Error('Email gönderilemedi (SendGrid)');
    }
};

module.exports = sendEmail;