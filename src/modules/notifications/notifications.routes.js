const express = require('express');
const router = express.Router();
const controller = require('./notifications.controller');

const optionalAuth = require('../../core/optionalAuth');

router.use(optionalAuth); // ✅ Bearer bo'lsa req.user to'ladi, bo'lmasa fallback ishlaydi

router.get('/', controller.list);
router.post('/read-all', controller.markAllRead);
router.post("/token", controller.registerToken);
router.post('/test-push', controller.testPush);
router.post('/:id/read', controller.markRead);

module.exports = router;
