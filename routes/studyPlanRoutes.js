const express = require('express');
const router = express.Router();
const { checkAndCreatePlan, getStudyPlan, submitDayResult, archiveCurrentPlan, getPlanHistory, getContentForDay, chatWithAi, getAllMasterLessons, getMasterLessonById, getAllStudentPlans, deleteStudentPlan, getStudentPlanForAdmin } = require('../controllers/studyPlanController');
const { protect } = require('../middleware/authMiddleware');

router.post('/check', protect, checkAndCreatePlan);
router.post('/create', protect, checkAndCreatePlan);
router.post('/submit', protect, submitDayResult);
router.put('/archive', protect, archiveCurrentPlan);
router.get('/history', protect, getPlanHistory);
router.get('/master-lessons', protect, getAllMasterLessons);
router.get('/master-lessons/:id', protect, getMasterLessonById);
router.get('/admin/all-plans', protect, getAllStudentPlans);
router.get('/admin/plan/:id', protect, getStudentPlanForAdmin); // New Admin Detail Route
router.delete('/admin/plan/:id', protect, deleteStudentPlan);

// AI Chat Route
router.post('/chat', protect, chatWithAi);

// Specific lesson route (ID or Slug for plan, Slug for lesson)
router.get('/:planId/:lessonSlug', protect, getContentForDay);

// Generic routes at the bottom to avoid conflicts
router.get('/', protect, getStudyPlan);
router.get('/:slug', protect, getStudyPlan);

module.exports = router;
