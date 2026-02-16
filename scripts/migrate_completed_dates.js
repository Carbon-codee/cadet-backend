const mongoose = require('mongoose');
const dotenv = require('dotenv');
const StudyPlan = require('../models/StudyPlan');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected to ' + process.env.MONGO_URI);

        const plans = await StudyPlan.find({});
        console.log(`Found ${plans.length} study plans.`);

        let updatedCount = 0;

        for (const plan of plans) {
            let planModified = false;
            for (const module of plan.modules) {
                if (module.isCompleted && !module.completedAt) {
                    // Set to yesterday
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    module.completedAt = yesterday;
                    planModified = true;
                }
            }

            if (planModified) {
                await plan.save();
                updatedCount++;
                console.log(`Updated plan: ${plan._id}`);
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} plans.`);
        process.exit();
    } catch (error) {
        console.error('Migration Error:', error);
        process.exit(1);
    }
};

migrate();
