const express = require('express');
const router = express.Router();
const controller = require('./inbox.controller');
const requireAuth = require('../../core/requireAuth');

// Public (debug)
router.get('/ping', (req, res) => res.json({ ok: true, route: 'inbox' }));

// ✅ Hammasi JWT bilan
router.use(requireAuth);

// Threads
router.get('/', controller.listThreads);
router.post('/threads', controller.createThread);

// Messages
router.get('/threads/:id', controller.getThread);
router.post('/threads/:id/messages', controller.sendMessage);

module.exports = router;
