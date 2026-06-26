const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middlewares/error');
const decryptRequest = require('./middlewares/decryptRequest');
const encryptResponse = require('./middlewares/encryptResponse');

const app = express();

// Enable CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body Parser Middleware
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl === '/api/orders/webhook') {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Serve static upload folders for offline mockup fallback
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ── AES-256-GCM Encryption Layer ─────────────────────────────────────────────
// Decrypt incoming encrypted request bodies (from frontend Axios interceptor)
app.use(decryptRequest);
// Encrypt all outgoing JSON responses (frontend Axios interceptor decrypts them)
app.use(encryptResponse);
// ─────────────────────────────────────────────────────────────────────────────

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is fully operational',
    timestamp: new Date(),
  });
});

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subcategoryRoutes = require('./routes/subcategoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const couponRoutes = require('./routes/couponRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

// Mount Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/settings', settingsRoutes);

// Catch-all route to return 404 for unhandled API calls
app.use('/api/*', (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Endpoint not found: ${req.originalUrl}`,
  });
});

// Mount Central Error Handler Middleware
app.use(errorHandler);

module.exports = app;
