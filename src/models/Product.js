const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter product name'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    sku: {
      type: String,
      required: [true, 'Please enter product SKU'],
      unique: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Please enter product short description'],
      trim: true,
    },
    fullDescription: {
      type: String,
      required: [true, 'Please enter product full description'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product must belong to a category'],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubCategory',
      required: [true, 'Product must belong to a subcategory'],
    },
    price: {
      type: Number,
      required: [true, 'Please enter product price'],
      max: [9999999, 'Price cannot exceed 7 figures'],
      default: 0.0,
    },
    salePrice: {
      type: Number,
      max: [9999999, 'Sale price cannot exceed 7 figures'],
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Please enter product stock quantity'],
      max: [99999, 'Stock cannot exceed 5 figures'],
      default: 0,
    },
    stockStatus: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'low_stock'],
      default: 'in_stock',
    },
    material: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number, // in kg
    },
    dimensions: {
      length: { type: Number }, // in cm
      width: { type: Number },
      height: { type: Number },
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        secure_url: {
          type: String,
          required: true,
        },
      },
    ],
    ratings: {
      type: Number,
      default: 0,
    },
    numOfReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-adjust stockStatus on save
productSchema.pre('save', function (next) {
  if (this.quantity === 0) {
    this.stockStatus = 'out_of_stock';
  } else if (this.quantity <= 5) {
    this.stockStatus = 'low_stock';
  } else {
    this.stockStatus = 'in_stock';
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
