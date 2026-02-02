const express = require('express');
const router = express.Router();
const controller = require('./inbox.controller');

router.get('/', controller.listThreads);
router.post('/threads', controller.createThread);

router.get('/threads/:id', controller.getThread);
router.post('/threads/:id/messages', controller.sendMessage);

module.exports = router;

