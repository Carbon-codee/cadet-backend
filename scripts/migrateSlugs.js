const mongoose = require('mongoose');
require('dotenv').config();

const Internship = require('../models/Internship');
const MasterLesson = require('../models/MasterLesson');
const Content = require('../models/Content');
const User = require('../models/User'); // Required for StudyPlan
const StudyPlan = require('../models/StudyPlan');

async function migrateSlugs() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const { generateSlug } = require('../utils/slugify');

        // --- INTERNSHIP ---
        console.log('\n📋 Migrating Internship slugs...');
        const internships = await Internship.find({ slug: { $exists: false } });
        for (const item of internships) { await item.save(); }

        // --- MASTERLESSON ---
        console.log('\n📚 Migrating MasterLesson slugs...');
        const lessons = await MasterLesson.find({ slug: { $exists: false } });
        for (const item of lessons) { await item.save(); }

        // --- CONTENT ---
        console.log('\n📄 Migrating Content slugs...');
        const contents = await Content.find({ slug: { $exists: false } });
        for (const item of contents) { await item.save(); }

        // --- STUDYPLAN (With Modules) ---
        console.log('\n📅 Migrating StudyPlan & Lesson Slugs (Force Update)...');

        // Fetch ALL plans to ensure modules get slugs even if plan already has one
        const allPlans = await StudyPlan.find({});
        console.log(`Processing ${allPlans.length} study plans...`);

        for (const item of allPlans) {
            let updated = false;
            try {
                // 1. Plan Slug Logic
                if (!item.slug) {
                    const student = await User.findById(item.student);
                    const company = await User.findById(item.targetCompany);

                    if (student && company) {
                        let baseSlug = generateSlug(`${student.name}-${company.name}-hazirlik`);
                        let slug = baseSlug;
                        let counter = 1;

                        while (await StudyPlan.findOne({ slug, _id: { $ne: item._id } })) {
                            slug = `${baseSlug}-${counter}`;
                            counter++;
                        }
                        item.slug = slug;
                        updated = true;
                        console.log(`  ✓ Generated Plan Slug: ${slug}`);
                    }
                }

                // 2. Modules Slug Logic
                if (item.modules && item.modules.length > 0) {
                    let modulesUpdated = false;
                    for (let mod of item.modules) {
                        // Check if slug exists OR string is empty
                        if (!mod.slug || mod.slug === '') {
                            let modSlug = generateSlug(mod.topic);

                            // Ensure uniqueness within this plan
                            let c = 1;
                            let tempSlug = modSlug;
                            // Check against other modules in same plan
                            while (item.modules.find(m => m.slug === tempSlug && m !== mod)) {
                                tempSlug = `${modSlug}-${c}`;
                                c++;
                            }
                            mod.slug = tempSlug;
                            modulesUpdated = true;
                        }
                    }
                    if (modulesUpdated) {
                        updated = true;
                        // console.log(`  ✓ Generated module slugs for plan: ${item.slug}`);
                    }
                }

                if (updated) {
                    await StudyPlan.updateOne(
                        { _id: item._id },
                        { $set: { slug: item.slug, modules: item.modules } }
                    );
                    console.log(`  ✓ Updates saved for plan: ${item.slug}`);
                }

            } catch (e) {
                console.error(`  ✗ Error StudyPlan ${item._id}: ${e.message}`);
            }
        }

        console.log('\n✨ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateSlugs();
