const express = require('express');
const {
  getProducts,
  getProduct,
  autocompleteSearch,
  getProductFilters,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
} = require('../controllers/productController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/', getProducts);
router.get('/autocomplete', autocompleteSearch);
router.get('/filters', getProductFilters);
router.get('/:idOrSlug', getProduct);

// Admin Routes
router.post('/', protect, authorize('admin'), upload.array('images', 10), createProduct);
router.put('/:id', protect, authorize('admin'), upload.array('images', 10), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.post('/bulk', protect, authorize('admin'), bulkUploadProducts);

module.exports = router;
