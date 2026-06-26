/**
 * Address Model
 * Sensitive fields (street, city, state, postalCode, phone) are transparently
 * encrypted at rest using AES-256-GCM via Mongoose setters/getters.
 *
 * Values are stored as: "ENC:<base64iv>:<base64ciphertext+tag>"
 * Plain values are returned automatically when accessing the field.
 */
const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../utils/crypto');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Encrypted sensitive fields ───────────────────────────────────────────
    street: {
      type: String,
      required: [true, 'Street address is required'],
      set: encryptField,
      get: decryptField,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      set: encryptField,
      get: decryptField,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      set: encryptField,
      get: decryptField,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code/ZIP is required'],
      set: encryptField,
      get: decryptField,
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      set: encryptField,
      get: decryptField,
    },
    // ────────────────────────────────────────────────────────────────────────

    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'India',
      // country is not sensitive — not encrypted
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Enable getters in toJSON / toObject so decrypted values are returned
    toJSON:   { getters: true },
    toObject: { getters: true },
  }
);

// Middleware to ensure only one default address exists per user
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Address', addressSchema);
