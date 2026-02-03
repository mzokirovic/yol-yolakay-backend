const express = require('express');
const router = express.Router();
const controller = require('./notifications.controller');

router.get('/', controller.list);
router.post('/:id/read', controller.markRead);
router.post('/read-all', controller.markAllRead);

module.exports = router;
