const express = require('express');
const router = express.Router();
const { checkAndCreatePlan, getStudyPlan, submitDayResult, archiveCurrentPlan, getPlanHistory, getContentForDay, chatWithAi, getAllMasterLessons, getMasterLessonById, getAllStudentPlans, deleteStudentPlan } = require('../controllers/studyPlanController');
const { protect } = require('../middleware/authMiddleware');

router.post('/check', protect, checkAndCreatePlan);
router.get('/', protect, getStudyPlan);
router.post('/submit', protect, submitDayResult);
router.put('/archive', protect, archiveCurrentPlan);
router.get('/history', protect, getPlanHistory);
router.get('/master-lessons', protect, getAllMasterLessons);
router.get('/master-lessons/:id', protect, getMasterLessonById);
router.get('/admin/all-plans', protect, getAllStudentPlans); // New Admin route
router.delete('/admin/plan/:id', protect, deleteStudentPlan); // New Admin route
router.get('/:planId/day/:dayNumber', protect, getContentForDay);
router.post('/chat', protect, chatWithAi);

module.exports = router;
