const Internship = require('../models/Internship');
const MasterLesson = require('../models/MasterLesson');

// @desc    Generate XML sitemap
// @route   GET /sitemap.xml
// @access  Public
const generateSitemap = async (req, res) => {
    try {
        const baseUrl = 'https://www.marine-cadet.com';

        // Fetch active internships and lessons
        const internships = await Internship.find({ isActive: true }).select('slug updatedAt');
        const lessons = await MasterLesson.find().select('slug lastUpdated');

        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Homepage
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>1.0</priority>\n';
        xml += '  </url>\n';

        // Internships Main Page
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/internships</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>0.9</priority>\n';
        xml += '  </url>\n';

        // Learning/Academy Main Page
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/learning</loc>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.9</priority>\n';
        xml += '  </url>\n';

        // Auth Page (Login/Register)
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/auth</loc>\n`;
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.5</priority>\n';
        xml += '  </url>\n';

        // Individual internship listings
        internships.forEach(internship => {
            if (internship.slug) {
                xml += '  <url>\n';
                xml += `    <loc>${baseUrl}/internships/${internship.slug}</loc>\n`;
                if (internship.updatedAt) {
                    xml += `    <lastmod>${internship.updatedAt.toISOString()}</lastmod>\n`;
                }
                xml += '    <changefreq>weekly</changefreq>\n';
                xml += '    <priority>0.8</priority>\n';
                xml += '  </url>\n';
            }
        });

        // Lessons/Courses (Repository/Learning Detail)
        lessons.forEach(lesson => {
            if (lesson.slug) {
                xml += '  <url>\n';
                xml += `    <loc>${baseUrl}/learning/${lesson.slug}</loc>\n`;
                if (lesson.lastUpdated) {
                    xml += `    <lastmod>${new Date(lesson.lastUpdated).toISOString()}</lastmod>\n`;
                }
                xml += '    <changefreq>monthly</changefreq>\n';
                xml += '    <priority>0.7</priority>\n';
                xml += '  </url>\n';
            }
        });

        xml += '</urlset>';

        // Set headers
        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Internal Server Error</error>');
    }
};

module.exports = { generateSitemap };
