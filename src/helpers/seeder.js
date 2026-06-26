const User = require('../models/User');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const Settings = require('../models/Settings');
const slugify = require('./slugify');

const seedDatabase = async (force = false) => {
  // Safety check to prevent running in production environment
  if (process.env.NODE_ENV === 'production') {
    console.log('Production environment detected. Database seeding is aborted for safety.');
    return;
  }

  try {
    if (!force) {
      // Check if database already has Garkoti data (if yes, skip seeding to preserve edits)
      const hasGarkotiAdmin = await User.findOne({ email: 'admin@garkoti.com' });
      if (hasGarkotiAdmin) {
        console.log('Database already has Garkoti data. Skipping seeder... (Use --force argument to reset database)');
        return;
      }
    }

    console.log('Cleaning database and starting seed script...');

    // Clear old Furniture/Lakdi data
    await User.deleteMany({});
    await Category.deleteMany({});
    await SubCategory.deleteMany({});
    await Product.deleteMany({});
    await Banner.deleteMany({});
    await Settings.deleteMany({});

    // 1. Seed Global Settings
    const settings = await Settings.create({
      key: 'global_settings',
      contactInfo: {
        email: 'support@garkoti.com',
        phone: '+91-8888888888',
        address: 'Garkoti Central Tower, Sector 62, Noida, UP, India',
        businessHours: 'Mon - Sat: 10:00 AM - 8:00 PM',
      },
      seoSettings: {
        metaTitle: 'Garkoti E-Commerce | Premium General Online Store',
        metaDescription: 'Shop electronics, organic daily groceries, latest fashion wear, and home essentials online at Garkoti.',
        ogTitle: 'Garkoti General Shopping Store',
        ogDescription: 'Shop premium products across multiple departments at Garkoti.',
      },
      cmsPages: {
        aboutUs: 'Garkoti E-Commerce is a leading online general store providing premium products ranging from state-of-the-art consumer electronics and organic grocery items to the latest trending fashion apparel. We ensure high durability, secure packaging, and ultra-fast deliveries.',
        contactUs: 'Reach out to our customer resolution desk for active inquiries regarding order statuses, bulk commercial supply rates, and vendor registrations.',
        faqs: [
          {
            question: 'What categories do you deliver?',
            answer: 'We deliver grocery essentials, consumer electronics, smart gadgets, and trending fashion wear directly to your doorstep.',
          },
          {
            question: 'Is COD (Cash on Delivery) available?',
            answer: 'Yes, we support Cash on Delivery (COD) for most pin codes in India, alongside secure online card and UPI payments.',
          },
        ],
        privacyPolicy: 'Your profile details are strictly encrypted. Garkoti respects client privacy laws and conforms to modern standards.',
        termsConditions: 'All online digital transactions are processed through authorized payment networks.',
        returnPolicy: 'We support hassle-free returns and product exchanges within 7 days of package delivery.',
      },
    });
    console.log('Seeded global settings for Garkoti');

    // 2. Create Admin & Customer Users
    const admin = await User.create({
      name: 'Garkoti Admin',
      email: 'admin@garkoti.com',
      password: 'admin123',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    });

    const customer = await User.create({
      name: 'Aarav Sharma',
      email: 'customer@garkoti.com',
      password: 'customer123',
      role: 'customer',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    });

    console.log('Seeded users: admin@garkoti.com (admin123) / customer@garkoti.com (customer123)');

    // 3. Create General Categories
    const categoriesData = [
      {
        name: 'Electronics',
        image: {
          public_id: 'mock_cat_electronics',
          secure_url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600',
        },
      },
      {
        name: 'Grocery',
        image: {
          public_id: 'mock_cat_grocery',
          secure_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
        },
      },
      {
        name: 'Fashion',
        image: {
          public_id: 'mock_cat_fashion',
          secure_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600',
        },
      },
    ];

    const seededCategories = [];
    for (const cat of categoriesData) {
      const slug = slugify(cat.name);
      const created = await Category.create({ ...cat, slug });
      seededCategories.push(created);
    }
    console.log('Seeded Garkoti Categories');

    // 4. Create Subcategories
    const subCategoriesData = [
      // Electronics
      { name: 'Mobiles', parentName: 'Electronics' },
      { name: 'Laptops', parentName: 'Electronics' },
      // Grocery
      { name: 'Drinks & Snacks', parentName: 'Grocery' },
      { name: 'Grains & Spices', parentName: 'Grocery' },
      // Fashion
      { name: 'Mens Wear', parentName: 'Fashion' },
      { name: 'Womens Wear', parentName: 'Fashion' },
    ];

    const seededSubs = [];
    for (const sub of subCategoriesData) {
      const parent = seededCategories.find((c) => c.name === sub.parentName);
      if (parent) {
        const slug = slugify(`${parent.slug}-${sub.name}`);
        const created = await SubCategory.create({
          name: sub.name,
          slug,
          category: parent._id,
        });
        seededSubs.push(created);
      }
    }
    console.log('Seeded Garkoti Subcategories');

    // 5. Create Products
    const productsData = [
      // Mobiles
      {
        name: 'Flagship Pro 5G Smartphone',
        sku: 'GKT-EL-MOB01',
        shortDescription: 'Latest 5G flagship phone with 120Hz AMOLED display and pro quad-camera system.',
        fullDescription: 'Discover incredible computing speeds with Garkoti Flagship Pro 5G. Equipped with a high-performance chipset, 12GB RAM, 256GB storage, and a stunning 108MP camera capture suite. Excellent for gaming, streaming, and professional photography.',
        catName: 'Electronics',
        subName: 'Mobiles',
        price: 79999,
        salePrice: 74999,
        quantity: 35,
        material: 'Gorilla Glass & Titanium Frame',
        brand: 'Garkoti Prime',
        color: 'Meteorite Black',
        weight: 0.2,
        dimensions: { length: 16, width: 7, height: 0.8 },
        tags: ['mobile', 'phone', '5g', 'electronics', 'smartphone'],
        isBestSeller: true,
        images: [
          { public_id: 'mock_prod_mob1', secure_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600' },
        ],
      },
      // Laptops
      {
        name: 'Ultra-thin Business Laptop',
        sku: 'GKT-EL-LAP01',
        shortDescription: 'Lightweight professional laptop with 14-inch QHD screen and 16-hour battery.',
        fullDescription: 'The Garkoti Ultra-thin Business Laptop is engineered for elite professionals and students. Offers sleek aluminum unibody build, fast PCIe SSD, backlit keyboard, and secure fingerprint sensor logins.',
        catName: 'Electronics',
        subName: 'Laptops',
        price: 95000,
        salePrice: 89999,
        quantity: 12,
        material: 'Anodized Aluminum',
        brand: 'Garkoti Tech',
        color: 'Space Grey',
        weight: 1.3,
        dimensions: { length: 31, width: 22, height: 1.4 },
        tags: ['laptop', 'computer', 'notebook', 'office'],
        isFeatured: true,
        images: [
          { public_id: 'mock_prod_lap1', secure_url: 'https://images.unsplash.com/photo-1496181130204-755241524eab?w=600' },
        ],
      },
      // Drinks & Snacks
      {
        name: 'Organic Roasted Arabica Coffee',
        sku: 'GKT-GR-DRK01',
        shortDescription: '100% organic single-origin medium roast Arabica coffee beans.',
        fullDescription: 'Start your mornings right with organic single-origin Arabica Coffee Beans from Garkoti Groceries. Handpicked from certified mountain estates, medium roasted to bring out rich caramel notes with subtle citrus acidity.',
        catName: 'Grocery',
        subName: 'Drinks & Snacks',
        price: 999,
        salePrice: 899,
        quantity: 150,
        material: 'Eco-friendly Paper Seal Pack',
        brand: 'Garkoti Organics',
        color: 'Deep Roasted Brown',
        weight: 0.5,
        dimensions: { length: 10, width: 6, height: 22 },
        tags: ['coffee', 'grocery', 'beverage', 'organic', 'snack'],
        isTrending: true,
        images: [
          { public_id: 'mock_prod_coffee', secure_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600' },
        ],
      },
      // Mens Wear
      {
        name: 'Classic Solid Cotton Polo Tee',
        sku: 'GKT-FA-CLO01',
        shortDescription: 'Premium 100% combed cotton pique polo shirt for smart-casual wear.',
        fullDescription: 'Step out in confidence with Garkoti Apparel Mens Polo Tee. Crafted from lightweight combed cotton, it offers high breathability, structured collar fit, and double-stitched hems for high durability.',
        catName: 'Fashion',
        subName: 'Mens Wear',
        price: 1499,
        salePrice: 999,
        quantity: 120,
        material: '100% Pique Cotton',
        brand: 'Garkoti Wear',
        color: 'Royal Navy Blue',
        weight: 0.25,
        dimensions: { length: 30, width: 25, height: 2 },
        tags: ['tshirt', 'menswear', 'clothing', 'fashion', 'polo'],
        isBestSeller: true,
        images: [
          { public_id: 'mock_prod_polo', secure_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600' },
        ],
      },
      // Grains & Spices
      {
        name: 'Organic Himalayan Pink Salt',
        sku: 'GKT-GR-SPI01',
        shortDescription: 'Pure mineral-rich pink rock salt crystals in shaker container.',
        fullDescription: 'Season your meals with pure Garkoti Himalayan Pink Salt. Mineral-rich, unrefined, and hand-extracted from rock mines. Contains 84 essential minerals for a healthy lifestyle.',
        catName: 'Grocery',
        subName: 'Grains & Spices',
        price: 299,
        salePrice: null,
        quantity: 200,
        material: 'PET Shaker Bottle',
        brand: 'Garkoti Organics',
        color: 'Natural Pink',
        weight: 0.4,
        dimensions: { length: 7, width: 7, height: 15 },
        tags: ['salt', 'grocery', 'organic', 'spices', 'cooking'],
        isTrending: true,
        images: [
          { public_id: 'mock_prod_salt', secure_url: 'https://images.unsplash.com/photo-1604542031651-5337d8914e58?w=600' },
        ],
      },
    ];

    for (const prod of productsData) {
      const cat = seededCategories.find((c) => c.name === prod.catName);
      const sub = seededSubs.find((s) => s.name === prod.subName);

      if (cat && sub) {
        const slug = slugify(`${prod.name}-${prod.sku}`);
        await Product.create({
          ...prod,
          slug,
          category: cat._id,
          subcategory: sub._id,
        });
      }
    }
    console.log('Seeded Products catalog successfully');

    // 6. Seed Slider Banners
    const bannersData = [
      {
        title: 'Mega Electronics Carnival',
        subtitle: 'Upgrade your tech index with flagship smartphones and business laptops.',
        type: 'hero',
        image: {
          public_id: 'mock_banner_hero1',
          secure_url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600',
        },
        link: '/shop?category=electronics',
      },
      {
        title: 'Organic Grocery Essentials',
        subtitle: 'Shop mountain-estate coffee, hand-milled spices, and organic grains at flat discounts.',
        type: 'hero',
        image: {
          public_id: 'mock_banner_hero2',
          secure_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600',
        },
        link: '/shop?category=grocery',
      },
      {
        title: 'Flash Sale: Up to 30% Off polo shirts',
        subtitle: 'Revamp your wardrobe with combed pique cotton collections.',
        type: 'offer',
        image: {
          public_id: 'mock_banner_offer1',
          secure_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
        },
        link: '/shop?category=fashion&subcategory=mens-wear',
      },
    ];

    for (const ban of bannersData) {
      await Banner.create(ban);
    }
    console.log('Seeded Garkoti sliders and banners');
    console.log('Database Garkoti Seeding successfully completed!');
  } catch (err) {
    console.error('Database seeding failed:', err.message);
  }
};

module.exports = seedDatabase;

// Support running this script directly from the terminal (e.g. node src/helpers/seeder.js --force)
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  const mongoose = require('mongoose');

  const runSeeder = async () => {
    try {
      await connectDB();
      const force = process.argv.includes('--force');
      await seedDatabase(force);
    } catch (error) {
      console.error('Seeder execution failed:', error.message);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  };
  runSeeder();
}
