const express = require('express');
const {
  getSubCategories,
  getSubCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} = require('../controllers/subcategoryController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.get('/', getSubCategories);
router.get('/:idOrSlug', getSubCategory);

// Admin Routes
router.post('/', protect, authorize('admin'), createSubCategory);
router.put('/:id', protect, authorize('admin'), updateSubCategory);
router.delete('/:id', protect, authorize('admin'), deleteSubCategory);

module.exports = router;
