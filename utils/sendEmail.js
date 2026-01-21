const { Resend } = require('resend');

// API Key'in yüklü olduğundan emin ol
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev', // Doğrulanmış domainin veya test maili
            to: options.email,
            subject: options.subject,
            // Hem düz metin hem HTML desteği
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #005A9C;">Marine Cadet Bildirimi</h2>
                    <p style="font-size: 16px;">${options.message.replace(/\n/g, '<br>')}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">Bu e-posta Marine Cadet sistemi tarafından otomatik gönderilmiştir.</p>
                </div>
            `,
            text: options.message // HTML desteklemeyen cihazlar için yedek
        });

        if (error) {
            console.error("Resend Hatası:", error);
            throw new Error("Mail gönderilemedi: " + error.message);
        }

        console.log("Mail başarıyla gönderildi ID:", data.id);
        return data;

    } catch (err) {
        console.error("Mail Servis Hatası:", err);
        // Hata olsa bile uygulamanın çökmemesi için hatayı fırlatmıyoruz, sadece logluyoruz
        // Ancak kritik işlemlerde (şifre sıfırlama) bunu handle etmelisin.
    }
};

module.exports = sendEmail;