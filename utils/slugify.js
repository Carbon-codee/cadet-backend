// Utility function to generate URL-friendly slugs
const generateSlug = (text) => {
    if (!text) return '';

    // Turkish character map
    const charMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    };

    // Replace Turkish characters
    let slug = text.split('').map(char => charMap[char] || char).join('');

    // Convert to lowercase, replace spaces and special chars with hyphens
    slug = slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return slug;
};

module.exports = { generateSlug };
