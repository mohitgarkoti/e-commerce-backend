const SubCategory = require('../models/SubCategory');
const Category = require('../models/Category');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const slugify = require('../helpers/slugify');
const { deleteImage } = require('../config/cloudinary');

// @desc    Get all subcategories (optional filter by category id/slug)
// @route   GET /api/subcategories
// @access  Public
exports.getSubCategories = catchAsync(async (req, res, next) => {
  const { categoryId, categorySlug } = req.query;
  const filter = {};

  if (req.query.activeOnly === 'true' || !req.user || req.user.role !== 'admin') {
    filter.isActive = true;
  }

  if (categoryId) {
    filter.category = categoryId;
  } else if (categorySlug) {
    const category = await Category.findOne({ slug: categorySlug });
    if (category) {
      filter.category = category._id;
    } else {
      return res.status(200).json(new ApiResponse(200, [], 'Category not found, empty list returned'));
    }
  }

  const subCategories = await SubCategory.find(filter).populate('category', 'name slug').sort('name');
  res.status(200).json(new ApiResponse(200, subCategories, 'Subcategories fetched successfully'));
});

// @desc    Get single subcategory by slug or id
// @route   GET /api/subcategories/:idOrSlug
// @access  Public
exports.getSubCategory = catchAsync(async (req, res, next) => {
  const { idOrSlug } = req.params;
  let subCategory;

  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    subCategory = await SubCategory.findById(idOrSlug).populate('category', 'name slug');
  } else {
    subCategory = await SubCategory.findOne({ slug: idOrSlug }).populate('category', 'name slug');
  }

  if (!subCategory) {
    return next(new ApiError(404, 'Subcategory not found'));
  }

  res.status(200).json(new ApiResponse(200, subCategory, 'Subcategory details fetched successfully'));
});

// @desc    Create a subcategory (Admin only)
// @route   POST /api/subcategories
// @access  Private/Admin
exports.createSubCategory = catchAsync(async (req, res, next) => {
  const { name, category, isActive } = req.body;

  if (!name || !category) {
    return next(new ApiError(400, 'Subcategory name and parent category ID are required'));
  }

  // Verify parent category exists
  const parentCategory = await Category.findById(category);
  if (!parentCategory) {
    return next(new ApiError(404, 'Parent category not found'));
  }

  const slug = slugify(`${parentCategory.slug}-${name}`);
  const existingSub = await SubCategory.findOne({ slug });

  if (existingSub) {
    return next(new ApiError(400, 'Subcategory with this name already exists in this category'));
  }

  const subCategory = await SubCategory.create({
    name,
    slug,
    category,
    isActive: isActive === false ? false : true,
  });

  res.status(201).json(new ApiResponse(201, subCategory, 'Subcategory created successfully'));
});

// @desc    Update a subcategory (Admin only)
// @route   PUT /api/subcategories/:id
// @access  Private/Admin
exports.updateSubCategory = catchAsync(async (req, res, next) => {
  const { name, category, isActive } = req.body;
  const subCategory = await SubCategory.findById(req.params.id);

  if (!subCategory) {
    return next(new ApiError(404, 'Subcategory not found'));
  }

  if (category) {
    const parentCategory = await Category.findById(category);
    if (!parentCategory) {
      return next(new ApiError(404, 'Parent category not found'));
    }
    subCategory.category = category;
  }

  if (name) {
    subCategory.name = name;
    // Recalculate slug
    const parent = await Category.findById(subCategory.category);
    subCategory.slug = slugify(`${parent.slug}-${name}`);
  }

  if (isActive !== undefined) {
    subCategory.isActive = isActive;
  }

  await subCategory.save();

  res.status(200).json(new ApiResponse(200, subCategory, 'Subcategory updated successfully'));
});

// @desc    Delete a subcategory (Admin only)
// @route   DELETE /api/subcategories/:id
// @access  Private/Admin
exports.deleteSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findById(req.params.id);

  if (!subCategory) {
    return next(new ApiError(404, 'Subcategory not found'));
  }

  // Cascade delete: Delete all products in this subcategory (deleting their images first)
  const products = await Product.find({ subcategory: subCategory._id });
  for (const product of products) {
    for (const image of product.images) {
      await deleteImage(image.public_id);
    }
  }
  await Product.deleteMany({ subcategory: subCategory._id });

  // Delete subcategory
  await SubCategory.deleteOne({ _id: subCategory._id });

  res.status(200).json(new ApiResponse(200, null, 'Subcategory and associated products deleted successfully'));
});
