// Helper script to find all img tags without alt attributes
// Run with: node scripts/findMissingAlts.js

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../cadet-frontend/src');
const results = [];

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                // Find img tags without alt or with empty alt
                if (line.includes('<img') && (!line.includes('alt=') || line.includes('alt=""') || line.includes("alt=''"))) {
                    results.push({
                        file: filePath.replace(process.cwd(), ''),
                        line: index + 1,
                        content: line.trim()
                    });
                }
            });
        }
    });
}

console.log('🔍 Scanning for images without alt tags...\n');
scanDirectory(srcDir);

if (results.length > 0) {
    console.log(`Found ${results.length} images without proper alt tags:\n`);
    results.forEach(r => {
        console.log(`📁 ${r.file}:${r.line}`);
        console.log(`   ${r.content}\n`);
    });
} else {
    console.log('✅ All images have alt tags!');
}
