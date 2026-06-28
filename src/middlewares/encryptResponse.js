
const { encrypt } = require('../utils/crypto');

const SKIP_PATHS = ['/api/health', '/api/orders/webhook', '/api/seed'];

module.exports = function encryptResponse(req, res, next) {
  if (SKIP_PATHS.some((p) => req.originalUrl.startsWith(p))) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    try {
      const encrypted = encrypt(data);
      return originalJson({ __enc: true, payload: encrypted });
    } catch (err) {
      console.error('[encryptResponse] Encryption failed:', err.message);
      return originalJson(data);
    }
  };

  next();
};
