const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    try {
        // Eğer dışarıdan özel bir HTML şablonu geldiyse onu kullan
        // Gelmediyse (şifre sıfırlama vb.) varsayılan basit bir tasarım kullan
        let htmlContent = options.html;

        if (!htmlContent) {
            // Varsayılan Basit Tasarım (Şifre sıfırlama vb. için)
            htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #005A9C;">Marine Cadet Bildirimi</h2>
                    <p style="font-size: 16px;">${options.message ? options.message.replace(/\n/g, '<br>') : ''}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">Marine Cadet Ekibi</p>
                </div>
            `;
        }

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
            to: options.email,
            subject: options.subject,
            html: htmlContent, // Artık dinamik
            text: options.message || 'Lütfen HTML destekleyen bir mail istemcisi kullanın.'
        });

        if (error) {
            console.error("Resend Hatası:", error);
            throw new Error(error.message);
        }

        console.log("Mail gönderildi ID:", data.id);
        return data;

    } catch (err) {
        console.error("Mail Servis Hatası:", err);
    }
};

module.exports = sendEmail;