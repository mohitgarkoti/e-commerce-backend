const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global_settings',
      unique: true,
    },
    websiteLogo: {
      public_id: { type: String, default: '' },
      secure_url: { type: String, default: '' },
    },
    favicon: {
      public_id: { type: String, default: '' },
      secure_url: { type: String, default: '' },
    },
    contactInfo: {
      email: { type: String, default: 'support@garkoti.com' },
      phone: { type: String, default: '+91-8888888888' },
      address: { type: String, default: 'Garkoti Central Tower, Sector 62, Noida, UP, India' },
      businessHours: { type: String, default: 'Mon - Sat: 10:00 AM - 8:00 PM' },
    },
    socialLinks: {
      facebook: { type: String, default: 'https://facebook.com' },
      instagram: { type: String, default: 'https://instagram.com' },
      twitter: { type: String, default: 'https://twitter.com' },
      youtube: { type: String, default: 'https://youtube.com' },
    },
    paymentSettings: {
      razorpayKeyId: { type: String, default: 'rzp_test_mockKeyId12345' },
    },
    seoSettings: {
      metaTitle: { type: String, default: 'Garkoti E-Commerce | Premium General Online Store' },
      metaDescription: { type: String, default: 'Shop electronics, organic daily groceries, latest fashion wear, and home essentials online at Garkoti.' },
      ogTitle: { type: String, default: 'Garkoti General Shopping Store' },
      ogDescription: { type: String, default: 'Shop premium products across multiple departments at Garkoti.' },
    },
    cmsPages: {
      aboutUs: {
        type: String,
        default: 'Garkoti E-Commerce is a leading online general store providing premium products ranging from state-of-the-art consumer electronics and organic grocery items to the latest trending fashion apparel. We ensure high durability, secure packaging, and ultra-fast deliveries.',
      },
      contactUs: {
        type: String,
        default: 'Reach out to our customer resolution desk for active inquiries regarding order statuses, bulk commercial supply rates, and vendor registrations.',
      },
      faqs: [
        {
          question: { type: String, default: 'What categories do you deliver?' },
          answer: { type: String, default: 'We deliver grocery essentials, consumer electronics, smart gadgets, and trending fashion wear directly to your doorstep.' },
        },
        {
          question: { type: String, default: 'Is COD (Cash on Delivery) available?' },
          answer: { type: String, default: 'Yes, we support Cash on Delivery (COD) for most pin codes in India, alongside secure online card and UPI payments.' },
        },
      ],
      privacyPolicy: {
        type: String,
        default: 'Your personal data is encrypted and managed with strict compliance. We do not sell or lease user lists to third parties.',
      },
      termsConditions: {
        type: String,
        default: 'All transactions are subject to validation checks. Custom ordered items cannot be cancelled post production kickoff.',
      },
      returnPolicy: {
        type: String,
        default: 'We accept returns on damage-on-arrival products within 48 hours. Items must have original packing tags intact.',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
