const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please enter coupon code'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Please specify discount type (percentage or flat)'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Please enter discount value'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Please set coupon expiry date'],
    },
    usageLimit: {
      type: Number,
      required: [true, 'Please set a usage limit'],
      default: 100,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Method to check if coupon is valid
couponSchema.methods.isValid = function () {
  const isExpired = new Date() > this.expiryDate;
  const isLimitReached = this.usedCount >= this.usageLimit;
  return this.active && !isExpired && !isLimitReached;
};

module.exports = mongoose.model('Coupon', couponSchema);
