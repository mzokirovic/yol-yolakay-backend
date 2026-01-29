require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Marshrutlarni ulash
const tripRoutes = require('./src/routes/tripRoutes');
app.use('/api/trips', tripRoutes);

// Bosh sahifa (Render ishlashini tekshirish uchun)
app.get('/', (req, res) => {
    res.json({ message: "Yo'l-Yo'lakay Backend is live!", status: "OK" });
});

// Xatolar bilan ishlash (Global Error Handler)
app.use((err, req, res, next) => {
    console.error("SERVER_ERROR:", err.stack);
    res.status(500).json({ error: "Server ichki xatosi yuz berdi" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Senior Server running on port ${PORT}`);
});