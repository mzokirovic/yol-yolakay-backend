// /home/mzokirovic/Desktop/yol-yolakay-backend/index.js

console.log("✅ BOOT FILE:", __filename);

require('dotenv').config();
const tripLifecycleJob = require('./src/jobs/tripLifecycleJob');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[REQUEST KELDI] Method: ${req.method} | URL: ${req.originalUrl}`);
  next();
});

// ================= ROUTELAR (HAMMASI SHU YERDA BO'LISHI SHART) =================

// 1. Trips
const tripRoutes = require('./src/modules/trips/trips.routes');
app.use('/api/trips', tripRoutes);

// 2. Profile
const profileRoutes = require('./src/modules/profile/profile.routes');
app.use('/api/profile', profileRoutes);

// 3. Inbox
const inboxRoutes = require('./src/modules/inbox/inbox.routes');
app.use('/api/inbox', inboxRoutes);

// 4. Notifications
const notificationsRoutes = require('./src/modules/notifications/notifications.routes');
app.use('/api/notifications', notificationsRoutes);

// 5. ✅ AUTH (TUZATILDI: TEPAGA OLIB CHIQILDI)
const authRoutes = require('./src/modules/auth/auth.routes');
app.use('/api/auth', authRoutes);

// =================================================================================

app.get('/', (req, res) => {
  res.json({ message: "Yo'l-Yo'lakay Backend is live!", status: "OK" });
});

// ✅ Global Error Handler (Doim Routelardan KEYIN, lekin Listen dan OLDIN)
app.use((err, req, res, next) => {
  const code = err.statusCode || err.status || 500;
  console.error("SERVER_ERROR:", err);
  res.status(code).json({ success:false, error: err.message || "Server ichki xatosi" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Senior Server running on port ${PORT}`);

    // ✅ AUTO-START scheduler
    tripLifecycleJob.start();
});