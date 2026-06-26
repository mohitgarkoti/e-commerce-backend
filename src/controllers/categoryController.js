const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const slugify = require('../helpers/slugify');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = catchAsync(async (req, res, next) => {
  const filter = {};
  
  // Customers can only see active categories
  if (req.query.activeOnly === 'true' || !req.user || req.user.role !== 'admin') {
    filter.isActive = true;
  }

  const categories = await Category.find(filter).sort('name');
  res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully'));
});

// @desc    Get single category by slug or id
// @route   GET /api/categories/:idOrSlug
// @access  Public
exports.getCategory = catchAsync(async (req, res, next) => {
  const { idOrSlug } = req.params;
  let category;

  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    category = await Category.findById(idOrSlug);
  } else {
    category = await Category.findOne({ slug: idOrSlug });
  }

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  res.status(200).json(new ApiResponse(200, category, 'Category details fetched successfully'));
});

// @desc    Create a category (Admin only)
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = catchAsync(async (req, res, next) => {
  const { name, isActive } = req.body;

  if (!name) {
    return next(new ApiError(400, 'Category name is required'));
  }

  if (!req.file) {
    return next(new ApiError(400, 'Category image is required'));
  }

  const slug = slugify(name);
  const existingCategory = await Category.findOne({ $or: [{ name }, { slug }] });

  if (existingCategory) {
    // Delete the uploaded file from temp to keep server clean
    fs.unlinkSync(req.file.path);
    return next(new ApiError(400, 'Category with this name or slug already exists'));
  }

  try {
    // Upload image to Cloudinary/Local
    const imageData = await uploadImage(req.file.path, 'categories');
    
    // Clean up temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const category = await Category.create({
      name,
      slug,
      image: imageData,
      isActive: isActive === 'false' ? false : true,
    });

    res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new ApiError(500, `Image upload failed: ${err.message}`));
  }
});

// @desc    Update a category (Admin only)
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = catchAsync(async (req, res, next) => {
  const { name, isActive } = req.body;
  const categoryId = req.params.id;

  const category = await Category.findById(categoryId);

  if (!category) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return next(new ApiError(404, 'Category not found'));
  }

  if (name) {
    category.name = name;
    category.slug = slugify(name);
  }

  if (isActive !== undefined) {
    category.isActive = isActive === 'false' ? false : true;
  }

  // If new image file is uploaded
  if (req.file) {
    try {
      // Delete old image
      if (category.image && category.image.public_id) {
        await deleteImage(category.image.public_id);
      }
      
      // Upload new image
      const imageData = await uploadImage(req.file.path, 'categories');
      category.image = imageData;
      
      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (err) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return next(new ApiError(500, `Image update failed: ${err.message}`));
    }
  }

  await category.save();

  res.status(200).json(new ApiResponse(200, category, 'Category updated successfully'));
});

// @desc    Delete a category (Admin only)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  // 1. Delete image from Cloudinary / Local
  if (category.image && category.image.public_id) {
    await deleteImage(category.image.public_id);
  }

  // 2. Cascade delete: Delete all subcategories of this category
  await SubCategory.deleteMany({ category: category._id });

  // 3. Cascade delete: Delete products of this category (or we can mark inactive, but cascade delete is standard for monorepo testing)
  // Let's first delete images of all products in this category
  const products = await Product.find({ category: category._id });
  for (const product of products) {
    for (const image of product.images) {
      await deleteImage(image.public_id);
    }
  }
  await Product.deleteMany({ category: category._id });

  // 4. Delete the category itself
  await Category.deleteOne({ _id: category._id });

  res.status(200).json(new ApiResponse(200, null, 'Category and all associated subcategories and products deleted successfully'));
});
