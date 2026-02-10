const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

// Cloudinary automatically reads CLOUDINARY_URL from .env
// No need for manual config unless overriding

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'cadet_avatars',
        allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'], // PDF eklendi
        resource_type: 'auto', // PDF ve resim için otomatik algılama
        public_id: (req, file) => {
            // Dosya ismini koru veya benzersiz yap
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return file.fieldname + '-' + uniqueSuffix;
        },
    },
});

const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };
