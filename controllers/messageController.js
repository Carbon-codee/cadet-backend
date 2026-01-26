const Message = require('../models/Message');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Mesaj Gönder
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, subject, content } = req.body;
        const senderId = req.user._id;

        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: 'Alıcı bulunamadı.' });
        }

        // 1. Mesajı Veritabanına Kaydet
        const newMessage = await Message.create({
            sender: senderId,
            receiver: receiverId,
            subject,
            content
        });

        // 2. E-posta Bildirimi Gönder
        const emailSubject = `Yeni Mesaj: ${subject}`;
        const emailContent = `
            <h3>Merhaba ${receiver.name},</h3>
            <p><strong>${req.user.name}</strong> (${req.user.role}) size bir mesaj gönderdi:</p>
            <blockquote style="border-left: 4px solid #005A9C; padding-left: 10px; color: #555;">
                ${content.replace(/\n/g, '<br>')}
            </blockquote>
            <p>Detaylar için platforma giriş yapabilirsiniz.</p>
        `;

        await sendEmail({
            email: receiver.email,
            subject: emailSubject,
            html: emailContent
        });

        res.status(201).json({ success: true, message: 'Mesaj gönderildi.', data: newMessage });

    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        res.status(500).json({ message: 'Mesaj gönderilemedi.' });
    }
};

// Mesajları Getir (Gelen ve Giden)
exports.getMessages = async (req, res) => {
    try {
        const userId = req.user._id;

        // Hem gelen hem giden mesajları çekelim
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        })
            .populate('sender', 'name surname role email')
            .populate('receiver', 'name surname role email')
            .sort({ createdAt: -1 });

        res.status(200).json(messages);

    } catch (error) {
        console.error('Mesajları getirme hatası:', error);
        res.status(500).json({ message: 'Mesajlar alınamadı.' });
    }
};

// Mesajı Sil (Gelen veya Giden kutusundan)
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Mesaj bulunamadı.' });
        }

        // Sadece gönderen veya alıcı silebilir
        if (message.sender.toString() !== req.user._id.toString() && message.receiver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
        }

        // Basit silme (Her iki taraftan da silinir - İstenirse soft delete yapılabilir)
        await Message.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Mesaj silindi.' });

    } catch (error) {
        console.error('Mesaj silme hatası:', error);
        res.status(500).json({ message: 'Mesaj silinemedi.' });
    }
};

// Mesaj Güncelle (Sadece Gönderen)
exports.updateMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Mesaj bulunamadı.' });
        }

        // Sadece gönderen düzenleyebilir
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Sadece kendi gönderdiğiniz mesajları düzenleyebilirsiniz.' });
        }

        message.content = req.body.content || message.content;
        await message.save();

        res.status(200).json({ success: true, message: 'Mesaj güncellendi.', data: message });

    } catch (error) {
        console.error('Mesaj güncelleme hatası:', error);
        res.status(500).json({ message: 'Mesaj güncellenemedi.' });
    }
};
