const express = require('express');
const router = express.Router();
const { checkAndCreatePlan, getStudyPlan, submitDayResult, archiveCurrentPlan, getPlanHistory, getContentForDay, chatWithAi } = require('../controllers/studyPlanController');
const { protect } = require('../middleware/authMiddleware');

router.post('/check', protect, checkAndCreatePlan);
router.get('/', protect, getStudyPlan);
router.post('/submit', protect, submitDayResult);
router.put('/archive', protect, archiveCurrentPlan);
router.get('/history', protect, getPlanHistory);
router.get('/:planId/day/:dayNumber', protect, getContentForDay);
router.post('/chat', protect, chatWithAi);

module.exports = router;
