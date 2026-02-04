console.log("✅ BOOT FILE:", __filename);

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQUEST KELDI] Method: ${req.method} | URL: ${req.originalUrl}`);
  next();
});

const tripRoutes = require('./src/modules/trips/trips.routes');
app.use('/api/trips', tripRoutes);

const profileRoutes = require('./src/modules/profile/profile.routes');
app.use('/api/profile', profileRoutes);

const inboxRoutes = require('./src/modules/inbox/inbox.routes');
app.use('/api/inbox', inboxRoutes);

// ✅ Notifications routes ham shu yerda bo‘lishi kerak
const notificationsRoutes = require('./src/modules/notifications/notifications.routes');
app.use('/api/notifications', notificationsRoutes);

app.get('/', (req, res) => {
  res.json({ message: "Yo'l-Yo'lakay Backend is live!", status: "OK" });
});

// ✅ Global Error Handler doim eng oxirida
app.use((err, req, res, next) => {
  const code = err.statusCode || 500;
  console.error("SERVER_ERROR:", err);
  res.status(code).json({ success:false, error: err.message || "Server ichki xatosi" });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Senior Server running on port ${PORT}`);
});
