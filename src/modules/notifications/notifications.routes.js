const express = require('express');
const router = express.Router();
const controller = require('./notifications.controller');

router.get('/', controller.list);
router.post('/:id/read', controller.markRead);
router.post('/read-all', controller.markAllRead);
router.post("/token", controller.registerToken);
router.post('/test-push', controller.testPush);
router.post('/:id/read', controller.markRead);

module.exports = router;
