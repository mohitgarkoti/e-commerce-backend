/**
 * Order Model
 * Sensitive fields in shippingAddress, guestInfo, and paymentDetails are
 * encrypted at rest using AES-256-GCM via Mongoose setters/getters.
 *
 * Encrypted fields:
 *   shippingAddress: street, city, state, postalCode, phone
 *   guestInfo: email, name, phone
 *   paymentDetails: paymentId, signature
 */
const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../utils/crypto');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Allow null for Guest Checkout
    },

    // ── Guest Info (encrypted) ───────────────────────────────────────────────
    guestInfo: {
      email: { type: String, default: '', set: encryptField, get: decryptField },
      name:  { type: String, default: '', set: encryptField, get: decryptField },
      phone: { type: String, default: '', set: encryptField, get: decryptField },
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name:     { type: String, required: true },
        sku:      { type: String, required: true },
        price:    { type: Number, required: true },
        quantity: { type: Number, required: true },
        image:    { type: String, required: true },
      },
    ],

    // ── Shipping Address (encrypted sensitive fields) ────────────────────────
    shippingAddress: {
      street:     { type: String, required: true, set: encryptField, get: decryptField },
      city:       { type: String, required: true, set: encryptField, get: decryptField },
      state:      { type: String, required: true, set: encryptField, get: decryptField },
      postalCode: { type: String, required: true, set: encryptField, get: decryptField },
      phone:      { type: String, required: true, set: encryptField, get: decryptField },
      // Country is not sensitive
      country:    { type: String, required: true },
    },

    paymentMethod: {
      type: String,
      enum: ['razorpay', 'cod'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },

    // ── Payment Details (encrypted) ──────────────────────────────────────────
    paymentDetails: {
      orderId:   { type: String, default: '' }, // Razorpay order ID — not sensitive
      paymentId: { type: String, default: '', set: encryptField, get: decryptField },
      signature: { type: String, default: '', set: encryptField, get: decryptField },
    },

    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
    totalAmount:     { type: Number, required: true },
    discountAmount:  { type: Number, default: 0 },
    shippingCharges: { type: Number, default: 0 },
    taxAmount:       { type: Number, default: 0 },
    finalAmount:     { type: Number, required: true },
    couponCode:      { type: String, default: '' },
    trackingId:      { type: String, default: '' },
    trackingHistory: [
      {
        status:    { type: String, required: true },
        comment:   { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    // Enable getters so decrypted values are included in JSON responses
    toJSON:   { getters: true },
    toObject: { getters: true },
  }
);

// Pre-save: auto-create initial tracking history entry if empty
orderSchema.pre('save', function (next) {
  if (this.isNew && this.trackingHistory.length === 0) {
    this.trackingHistory.push({
      status: 'pending',
      comment: 'Order placed successfully. Awaiting payment/confirmation.',
    });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
