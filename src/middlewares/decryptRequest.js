
const { decrypt } = require('../utils/crypto');

const SKIP_PATHS = ['/api/orders/webhook'];

module.exports = function decryptRequest(req, res, next) {
  if (SKIP_PATHS.some((p) => req.originalUrl.startsWith(p)) || !req.body) {
    return next();
  }

  if (req.body.__enc === true && req.body.payload) {
    try {
      const decryptedStr = decrypt(req.body.payload);
      req.body = JSON.parse(decryptedStr);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid encrypted request payload. Decryption failed.',
      });
    }
  }

  next();
};
