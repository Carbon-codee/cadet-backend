const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const debugUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Bağlandı.");

        const users = await User.find({}, 'name email role isApproved status studentBarcode');

        console.log("KULLANICILAR:");
        console.log(JSON.stringify(users.map(u => ({
            _id: u._id.toString(),
            name: u.name,
            email: u.email,
            role: u.role,
            isApproved: u.isApproved,
            status: u.status,
            studentBarcode: u.studentBarcode
        })), null, 2));

        process.exit();
    } catch (error) {
        console.error("Hata:", error);
        process.exit(1);
    }
};

debugUsers();
