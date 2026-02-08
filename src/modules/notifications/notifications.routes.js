const express = require('express');
const router = express.Router();
const controller = require('./notifications.controller');

const requireAuth = require('../../core/requireAuth');

router.use(requireAuth); // ✅ endi hammasi JWT bilan

router.get('/', controller.list);
router.post('/read-all', controller.markAllRead);
router.post('/token', controller.registerToken);
router.post('/test-push', controller.testPush);
router.post('/:id/read', controller.markRead);

module.exports = router;
