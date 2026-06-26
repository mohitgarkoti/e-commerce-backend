const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Review = require('../models/Review');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const slugify = require('../helpers/slugify');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get all products with advanced filters, pagination, and sorting
// @route   GET /api/products
// @access  Public
exports.getProducts = catchAsync(async (req, res, next) => {
  const {
    search,
    category,
    subcategory,
    minPrice,
    maxPrice,
    brand,
    material,
    color,
    rating,
    stockStatus,
    isFeatured,
    isTrending,
    isBestSeller,
    sort,
  } = req.query;

  const queryObj = {};

  // Default is active products only for customers
  if (!req.user || req.user.role !== 'admin') {
    queryObj.isActive = true;
  } else if (req.query.isActive !== undefined) {
    queryObj.isActive = req.query.isActive === 'true';
  }

  // 1. Search filter (Name, SKU, Tags, Short Description)
  if (search) {
    queryObj.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
      { shortDescription: { $regex: search, $options: 'i' } },
    ];
  }

  // 2. Category Filter
  if (category) {
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      queryObj.category = category;
    } else {
      const cat = await Category.findOne({ slug: category });
      if (cat) queryObj.category = cat._id;
      else return res.status(200).json(new ApiResponse(200, { products: [], total: 0, pages: 0 }, 'Category not found'));
    }
  }

  // 3. Subcategory Filter
  if (subcategory) {
    if (subcategory.match(/^[0-9a-fA-F]{24}$/)) {
      queryObj.subcategory = subcategory;
    } else {
      const sub = await SubCategory.findOne({ slug: subcategory });
      if (sub) queryObj.subcategory = sub._id;
      else return res.status(200).json(new ApiResponse(200, { products: [], total: 0, pages: 0 }, 'Subcategory not found'));
    }
  }

  // 4. Price range filter
  if (minPrice || maxPrice) {
    queryObj.price = {};
    if (minPrice) queryObj.price.$gte = Number(minPrice);
    if (maxPrice) queryObj.price.$lte = Number(maxPrice);
  }

  // 5. Brand filter (supports comma-separated list)
  if (brand) {
    const brands = brand.split(',');
    queryObj.brand = { $in: brands.map((b) => new RegExp(`^${b.trim()}$`, 'i')) };
  }

  // 6. Material filter
  if (material) {
    const materials = material.split(',');
    queryObj.material = { $in: materials.map((m) => new RegExp(`^${m.trim()}$`, 'i')) };
  }

  // 7. Color filter
  if (color) {
    const colors = color.split(',');
    queryObj.color = { $in: colors.map((c) => new RegExp(`^${c.trim()}$`, 'i')) };
  }

  // 8. Rating filter
  if (rating) {
    queryObj.ratings = { $gte: Number(rating) };
  }

  // 9. Stock Availability filter
  if (stockStatus) {
    queryObj.stockStatus = stockStatus;
  }

  // 10. Promotional Flags
  if (isFeatured) queryObj.isFeatured = isFeatured === 'true';
  if (isTrending) queryObj.isTrending = isTrending === 'true';
  if (isBestSeller) queryObj.isBestSeller = isBestSeller === 'true';

  // Sort logic
  let sortBy = '-createdAt'; // Default newest first
  if (sort) {
    switch (sort) {
      case 'newest':
        sortBy = '-createdAt';
        break;
      case 'best_selling':
        sortBy = '-isBestSeller'; // or sales volume if modeled
        break;
      case 'price_asc':
        sortBy = 'price';
        break;
      case 'price_desc':
        sortBy = '-price';
        break;
      default:
        sortBy = '-createdAt';
    }
  }

  // Pagination
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments(queryObj);
  const products = await Product.find(queryObj)
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .sort(sortBy)
    .skip(skip)
    .limit(limit);

  const pages = Math.ceil(total / limit);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        total,
        page,
        pages,
        limit,
      },
      'Products fetched successfully'
    )
  );
});

// @desc    Get single product details
// @route   GET /api/products/:idOrSlug
// @access  Public
exports.getProduct = catchAsync(async (req, res, next) => {
  const { idOrSlug } = req.params;
  let product;

  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    product = await Product.findById(idOrSlug)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug');
  } else {
    product = await Product.findOne({ slug: idOrSlug })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug');
  }

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  res.status(200).json(new ApiResponse(200, product, 'Product details fetched successfully'));
});

// @desc    Autocomplete Suggestions for search inputs
// @route   GET /api/products/autocomplete
// @access  Public
exports.autocompleteSearch = catchAsync(async (req, res, next) => {
  const { q } = req.query;
  if (!q) {
    return res.status(200).json(new ApiResponse(200, [], 'Empty query'));
  }

  // Return name, slug, SKU, category matching the string
  const products = await Product.find(
    {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
      ],
    },
    'name slug sku images price salePrice stockStatus'
  )
    .limit(8)
    .lean();

  res.status(200).json(new ApiResponse(200, products, 'Autocomplete suggestions fetched'));
});

// @desc    Create a product (Admin only)
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = catchAsync(async (req, res, next) => {
  const {
    name,
    sku,
    shortDescription,
    fullDescription,
    category,
    subcategory,
    price,
    salePrice,
    quantity,
    material,
    brand,
    color,
    weight,
    dimensions, // JSON string or object
    tags, // Comma separated or array
    isFeatured,
    isTrending,
    isBestSeller,
    isActive,
  } = req.body;

  if (!name || !sku || !shortDescription || !fullDescription || !category || !subcategory || !price) {
    if (req.files) {
      req.files.forEach((f) => fs.unlinkSync(f.path));
    }
    return next(new ApiError(400, 'All core fields are required'));
  }

  const existingProduct = await Product.findOne({ sku });
  if (existingProduct) {
    if (req.files) req.files.forEach((f) => fs.unlinkSync(f.path));
    return next(new ApiError(400, 'A product with this SKU already exists'));
  }

  if (!req.files || req.files.length === 0) {
    return next(new ApiError(400, 'Please upload at least one image'));
  }

  try {
    const uploadedImages = [];
    for (const file of req.files) {
      const imgData = await uploadImage(file.path, 'products');
      uploadedImages.push(imgData);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    // Parse structures
    let parsedDimensions = { length: 0, width: 0, height: 0 };
    if (dimensions) {
      parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
    }

    let parsedTags = [];
    if (tags) {
      parsedTags = typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags;
    }

    const slug = slugify(`${name}-${sku}`);

    const product = await Product.create({
      name,
      slug,
      sku,
      shortDescription,
      fullDescription,
      category,
      subcategory,
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : null,
      quantity: Number(quantity || 0),
      material,
      brand,
      color,
      weight: weight ? Number(weight) : undefined,
      dimensions: parsedDimensions,
      tags: parsedTags,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isTrending: isTrending === 'true' || isTrending === true,
      isBestSeller: isBestSeller === 'true' || isBestSeller === true,
      isActive: isActive === 'false' || isActive === false ? false : true,
      images: uploadedImages,
    });

    res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
  } catch (err) {
    if (req.files) {
      req.files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    return next(new ApiError(500, `Product creation failed: ${err.message}`));
  }
});

// @desc    Update product (Admin only)
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    if (req.files) req.files.forEach((f) => fs.unlinkSync(f.path));
    return next(new ApiError(404, 'Product not found'));
  }

  const {
    name,
    shortDescription,
    fullDescription,
    category,
    subcategory,
    price,
    salePrice,
    quantity,
    material,
    brand,
    color,
    weight,
    dimensions,
    tags,
    isFeatured,
    isTrending,
    isBestSeller,
    isActive,
    keepImages, // array or comma-separated list of image public_ids to keep
  } = req.body;

  if (name) {
    product.name = name;
    product.slug = slugify(`${name}-${product.sku}`);
  }

  if (shortDescription) product.shortDescription = shortDescription;
  if (fullDescription) product.fullDescription = fullDescription;
  if (category) product.category = category;
  if (subcategory) product.subcategory = subcategory;
  if (price) product.price = Number(price);
  if (salePrice !== undefined) product.salePrice = salePrice ? Number(salePrice) : null;
  if (quantity !== undefined) product.quantity = Number(quantity);
  if (material !== undefined) product.material = material;
  if (brand !== undefined) product.brand = brand;
  if (color !== undefined) product.color = color;
  if (weight !== undefined) product.weight = weight ? Number(weight) : undefined;

  if (dimensions) {
    product.dimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
  }

  if (tags) {
    product.tags = typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags;
  }

  if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true' || isFeatured === true;
  if (isTrending !== undefined) product.isTrending = isTrending === 'true' || isTrending === true;
  if (isBestSeller !== undefined) product.isBestSeller = isBestSeller === 'true' || isBestSeller === true;
  if (isActive !== undefined) product.isActive = isActive === 'true' || isActive === true;

  // Image Management
  let parsedKeepImages = [];
  if (keepImages) {
    parsedKeepImages = typeof keepImages === 'string' ? keepImages.split(',') : keepImages;
  }

  // Delete images that are NOT in the keep list
  const imagesToDestroy = product.images.filter((img) => !parsedKeepImages.includes(img.public_id));
  for (const img of imagesToDestroy) {
    await deleteImage(img.public_id);
  }
  
  // Update image list
  product.images = product.images.filter((img) => parsedKeepImages.includes(img.public_id));

  // If new files uploaded
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const imgData = await uploadImage(file.path, 'products');
        product.images.push(imgData);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    } catch (err) {
      if (req.files) {
        req.files.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
      }
      return next(new ApiError(500, `Product image upload failed: ${err.message}`));
    }
  }

  await product.save();

  res.status(200).json(new ApiResponse(200, product, 'Product updated successfully'));
});

// @desc    Delete product (Admin only)
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // 1. Delete images from Cloudinary/Local
  for (const img of product.images) {
    await deleteImage(img.public_id);
  }

  // 2. Delete linked reviews
  await Review.deleteMany({ product: product._id });

  // 3. Delete product
  await Product.deleteOne({ _id: product._id });

  res.status(200).json(new ApiResponse(200, null, 'Product and all associated reviews deleted successfully'));
});

// @desc    Bulk Upload products (Admin only)
// @route   POST /api/products/bulk
// @access  Private/Admin
exports.bulkUploadProducts = catchAsync(async (req, res, next) => {
  const { products } = req.body; // array of product objects
  
  if (!products || !Array.isArray(products) || products.length === 0) {
    return next(new ApiError(400, 'Products list array is required for bulk upload'));
  }

  const createdProducts = [];
  const errors = [];

  for (const item of products) {
    try {
      const { name, sku, category, subcategory, price, quantity, shortDescription, fullDescription } = item;
      
      const existing = await Product.findOne({ sku });
      if (existing) {
        errors.push(`SKU ${sku} already exists`);
        continue;
      }

      const categoryDoc = await Category.findOne({ name: category });
      const subcategoryDoc = await SubCategory.findOne({ name: subcategory });

      if (!categoryDoc || !subcategoryDoc) {
        errors.push(`SKU ${sku}: Category (${category}) or Subcategory (${subcategory}) not found in DB`);
        continue;
      }

      const slug = slugify(`${name}-${sku}`);
      
      const newProduct = await Product.create({
        ...item,
        slug,
        category: categoryDoc._id,
        subcategory: subcategoryDoc._id,
        price: Number(price),
        quantity: Number(quantity || 0),
        shortDescription: shortDescription || `${name} premium product.`,
        fullDescription: fullDescription || `${name} premium product built with high-grade materials.`,
        images: item.images || [{ public_id: 'mock_bulk', secure_url: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500' }] // default placeholder
      });
      createdProducts.push(newProduct);
    } catch (err) {
      errors.push(`SKU ${item.sku} failed: ${err.message}`);
    }
  }

  res.status(201).json(new ApiResponse(201, {
    uploadedCount: createdProducts.length,
    failuresCount: errors.length,
    errors
  }, 'Bulk upload completed'));
});

// @desc    Get unique filter values (brands, materials, colors)
// @route   GET /api/products/filters
// @access  Public
exports.getProductFilters = catchAsync(async (req, res, next) => {
  const {
    search,
    category,
    subcategory,
    minPrice,
    maxPrice,
    rating,
    stockStatus,
  } = req.query;

  const queryObj = { isActive: true };

  // 1. Search filter
  if (search) {
    queryObj.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
      { shortDescription: { $regex: search, $options: 'i' } },
    ];
  }

  // 2. Category Filter
  if (category) {
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      queryObj.category = category;
    } else {
      const cat = await Category.findOne({ slug: category });
      if (cat) queryObj.category = cat._id;
    }
  }

  // 3. Subcategory Filter
  if (subcategory) {
    if (subcategory.match(/^[0-9a-fA-F]{24}$/)) {
      queryObj.subcategory = subcategory;
    } else {
      const sub = await SubCategory.findOne({ slug: subcategory });
      if (sub) queryObj.subcategory = sub._id;
    }
  }

  // 4. Price range filter
  if (minPrice || maxPrice) {
    queryObj.price = {};
    if (minPrice) queryObj.price.$gte = Number(minPrice);
    if (maxPrice) queryObj.price.$lte = Number(maxPrice);
  }

  // 5. Rating filter
  if (rating) {
    queryObj.ratings = { $gte: Number(rating) };
  }

  // 6. Stock Availability filter
  if (stockStatus) {
    queryObj.stockStatus = stockStatus;
  }

  const brands = await Product.distinct('brand', queryObj);
  const materials = await Product.distinct('material', queryObj);
  const colors = await Product.distinct('color', queryObj);

  const filteredBrands = brands.filter((b) => b && b.trim() !== '');
  const filteredMaterials = materials.filter((m) => m && m.trim() !== '');
  const filteredColors = colors.filter((c) => c && c.trim() !== '');

  res.status(200).json(
    new ApiResponse(
      200,
      {
        brands: filteredBrands,
        materials: filteredMaterials,
        colors: filteredColors,
      },
      'Unique filter values fetched successfully'
    )
  );
});
