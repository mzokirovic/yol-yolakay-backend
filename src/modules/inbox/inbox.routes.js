const express = require('express');
const router = express.Router();
const controller = require('./inbox.controller');

// ✅ Health check (debug)
router.get('/ping', (req, res) => res.json({ ok: true, route: 'inbox' }));

// Threads
router.get('/', controller.listThreads);
router.post('/threads', controller.createThread);

// Messages
router.get('/threads/:id', controller.getThread);
router.post('/threads/:id/messages', controller.sendMessage);

module.exports = router;
