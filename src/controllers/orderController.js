const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { createOrder: createRzpOrder, verifyPayment: verifyRzpPayment } = require('../config/razorpay');
const generatePDFInvoice = require('../helpers/invoice');
const sendEmail = require('../config/nodemailer');

// Helper to calculate order prices using DB product data
const calculateOrderPricing = async (itemsInput, couponCodeInput) => {
  let totalAmount = 0;
  const items = [];

  for (const item of itemsInput) {
    const product = await Product.findById(item.product);
    if (!product || !product.isActive) {
      throw new ApiError(404, `Product not found or inactive: ${item.name || item.product}`);
    }

    if (product.quantity < item.quantity) {
      throw new ApiError(400, `Insufficient stock for product ${product.name}. Available: ${product.quantity}`);
    }

    const price = product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
    totalAmount += price * item.quantity;

    items.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      price,
      quantity: item.quantity,
      image: product.images[0] ? product.images[0].secure_url : 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500',
    });
  }

  // Handle Coupon Discount
  let discountAmount = 0;
  let couponCode = '';
  if (couponCodeInput) {
    const coupon = await Coupon.findOne({ code: couponCodeInput.toUpperCase(), active: true });
    if (coupon && coupon.isValid()) {
      couponCode = coupon.code;
      if (coupon.discountType === 'percentage') {
        discountAmount = (totalAmount * coupon.discountValue) / 100;
      } else {
        discountAmount = coupon.discountValue;
      }
      // Coupon limit check
      if (discountAmount > totalAmount) {
        discountAmount = totalAmount;
      }
    }
  }

  // Taxes (18% GST)
  const taxableAmount = totalAmount - discountAmount;
  const taxAmount = Math.round(taxableAmount * 0.18 * 100) / 100;

  // Shipping charges (free if final amount > 20000 INR, else 500 INR)
  const shippingCharges = taxableAmount > 20000 ? 0 : 500;

  const finalAmount = Math.round((taxableAmount + taxAmount + shippingCharges) * 100) / 100;

  return {
    items,
    totalAmount,
    discountAmount,
    taxAmount,
    shippingCharges,
    finalAmount,
    couponCode,
  };
};

// @desc    Initiate Checkout / Create Order (Logged In / Guest)
// @route   POST /api/orders
// @access  Public (Guest) or Private (Logged In)
exports.createOrder = catchAsync(async (req, res, next) => {
  const {
    items: itemsInput,
    shippingAddress,
    paymentMethod,
    couponCode: couponCodeInput,
    guestInfo,
  } = req.body;

  if (!itemsInput || itemsInput.length === 0 || !shippingAddress || !paymentMethod) {
    return next(new ApiError(400, 'Order items, shipping address, and payment method are required'));
  }

  // Guest validation
  if (!req.user && (!guestInfo || !guestInfo.email || !guestInfo.name || !guestInfo.phone)) {
    return next(new ApiError(400, 'Guest user information (email, name, phone) is required for guest checkout'));
  }

  // Calculate prices using DB to secure prices
  const pricing = await calculateOrderPricing(itemsInput, couponCodeInput);

  // Create base Order model
  const orderData = {
    user: req.user ? req.user.id : null,
    guestInfo: req.user ? undefined : guestInfo,
    items: pricing.items,
    shippingAddress,
    paymentMethod,
    totalAmount: pricing.totalAmount,
    discountAmount: pricing.discountAmount,
    taxAmount: pricing.taxAmount,
    shippingCharges: pricing.shippingCharges,
    finalAmount: pricing.finalAmount,
    couponCode: pricing.couponCode,
    paymentStatus: 'pending',
    orderStatus: 'pending',
  };

  const order = await Order.create(orderData);

  // Handle Cash On Delivery (COD)
  if (paymentMethod === 'cod') {
    order.orderStatus = 'confirmed';
    order.paymentStatus = 'pending';
    order.trackingHistory.push({
      status: 'confirmed',
      comment: 'Cash on delivery order confirmed automatically.',
    });
    await order.save();

    // Deduct stock immediately
    for (const item of pricing.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity },
      });
    }

    // Clear User Cart if logged in
    if (req.user) {
      await Cart.findOneAndUpdate({ user: req.user.id }, { $set: { items: [], couponCode: null, discount: 0 } });
    }

    // Increment coupon count if used
    if (pricing.couponCode) {
      await Coupon.findOneAndUpdate({ code: pricing.couponCode }, { $inc: { usedCount: 1 } });
    }

    // Send email confirmation
    const clientEmail = req.user ? req.user.email : guestInfo.email;
    const clientName = req.user ? req.user.name : guestInfo.name;
    await sendEmail({
      to: clientEmail,
      subject: `Garkoti E-Commerce - Order Confirmed #${order._id}`,
      html: `
        <h2>Hi ${clientName},</h2>
        <p>Thank you for shopping with us! Your order <strong>#${order._id}</strong> has been confirmed.</p>
        <p>Payment Method: Cash On Delivery</p>
        <p>Order Total: <strong>INR ${order.finalAmount.toFixed(2)}</strong></p>
        <p>You can track and download invoices on our platform.</p>
      `,
    });

    return res.status(201).json(new ApiResponse(201, { order }, 'COD Order placed successfully'));
  }

  // Handle Online Payments via Razorpay
  if (paymentMethod === 'razorpay') {
    try {
      const rzpOrder = await createRzpOrder(pricing.finalAmount, order._id.toString());

      order.paymentDetails = {
        orderId: rzpOrder.id,
      };
      await order.save();

      return res.status(201).json(
        new ApiResponse(
          201,
          {
            orderId: order._id,
            razorpayOrder: rzpOrder,
            razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockKeyId12345',
          },
          'Razorpay order created successfully. Procced to payment.'
        )
      );
    } catch (error) {
      // Cleanup the order if Razorpay failure occurs
      await Order.findByIdAndDelete(order._id);
      return next(new ApiError(500, `Razorpay Integration Failed: ${error.message}`));
    }
  }

  return next(new ApiError(400, 'Invalid payment method selected'));
});

// Helper to complete order after payment confirmation (used by client verify & webhook)
const finalizeOrderPayment = async (order, paymentId, signature) => {
  if (order.paymentStatus === 'completed') {
    return order;
  }

  // Payment Successful
  order.paymentStatus = 'completed';
  order.orderStatus = 'confirmed';
  if (!order.paymentDetails) {
    order.paymentDetails = {};
  }
  order.paymentDetails.paymentId = paymentId;
  if (signature) {
    order.paymentDetails.signature = signature;
  }
  order.trackingHistory.push({
    status: 'confirmed',
    comment: 'Payment verified successfully. Order confirmed.',
  });
  await order.save();

  // Deduct Stock levels
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: -item.quantity },
    });
  }

  // Clear User Cart if logged in
  if (order.user) {
    await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [], couponCode: null, discount: 0 } });
  }

  // Increment coupon count if used
  if (order.couponCode) {
    await Coupon.findOneAndUpdate({ code: order.couponCode }, { $inc: { usedCount: 1 } });
  }

  // Send email confirmation
  try {
    const clientEmail = order.user ? (await order.populate('user', 'email')).user.email : order.guestInfo.email;
    const clientName = order.user ? (await order.populate('user', 'name')).user.name : order.guestInfo.name;
    await sendEmail({
      to: clientEmail,
      subject: `Garkoti E-Commerce - Payment Successful Order #${order._id}`,
      html: `
        <h2>Hi ${clientName},</h2>
        <p>Thank you for shopping with us! Your payment for order <strong>#${order._id}</strong> has been successfully received.</p>
        <p>Razorpay Payment ID: ${paymentId}</p>
        <p>Total Paid: <strong>INR ${order.finalAmount.toFixed(2)}</strong></p>
        <p>Your items are being prepared for packaging.</p>
      `,
    });
  } catch (emailError) {
    console.error(`Email confirmation failed for order ${order._id}:`, emailError.message);
  }

  return order;
};

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/orders/verify
// @access  Public
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return next(new ApiError(400, 'All payment validation fields are required'));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ApiError(404, 'Order record not found'));
  }

  // If order is already completed (e.g. by Webhook), succeed immediately
  if (order.paymentStatus === 'completed') {
    return res.status(200).json(new ApiResponse(200, order, 'Payment verified and order confirmed successfully'));
  }

  const crypto = require('crypto');
  const text = razorpayOrderId + '|' + razorpayPaymentId;
  const isMock = razorpayOrderId.startsWith('order_mock_');

  let isValid = false;
  if (isMock) {
    isValid = true;
  } else {
    const generated = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'mockKeySecret54321')
      .update(text)
      .digest('hex');
    isValid = generated === razorpaySignature;
  }

  if (isValid) {
    const updatedOrder = await finalizeOrderPayment(order, razorpayPaymentId, razorpaySignature);
    res.status(200).json(new ApiResponse(200, updatedOrder, 'Payment verified and order confirmed successfully'));
  } else {
    // Payment failed
    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    order.trackingHistory.push({
      status: 'cancelled',
      comment: 'Payment signature validation failed.',
    });
    await order.save();

    res.status(400).json(new ApiResponse(400, order, 'Payment verification failed. Invalid signature.'));
  }
});

// @desc    Razorpay Webhook Handler
// @route   POST /api/orders/webhook
// @access  Public
exports.razorpayWebhook = catchAsync(async (req, res, next) => {
  console.log(req.body, "---- req.body");
  console.log(req.rawBody, "---- req.rawBody");

  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockWebhookSecret12345';

  if (!signature) {
    return next(new ApiError(400, 'Webhook signature is missing'));
  }

  // Verify signature
  const crypto = require('crypto');
  const rawBodyString = req.rawBody ? req.rawBody.toString() : '';

  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBodyString)
    .digest('hex');

  const isValid = generatedSignature === signature;

  if (!isValid && !(process.env.NODE_ENV === 'development' && signature === 'mock_signature')) {
    return next(new ApiError(400, 'Invalid webhook signature'));
  }

  const eventPayload = req.body;

  if (eventPayload.event === 'order.paid' || eventPayload.event === 'payment.captured') {
    let order = null;
    let paymentId = '';
    let rzpOrderId = '';

    if (eventPayload.event === 'order.paid') {
      const { order: rzpOrderPayload, payment: rzpPaymentPayload } = eventPayload.payload;
      rzpOrderId = rzpOrderPayload.entity.id;
      paymentId = rzpPaymentPayload.entity.id;
      const orderId = rzpOrderPayload.entity.receipt;

      if (orderId && orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId);
      }
      if (!order && rzpOrderId) {
        order = await Order.findOne({ 'paymentDetails.orderId': rzpOrderId });
      }
    } else if (eventPayload.event === 'payment.captured') {
      const { payment: rzpPaymentPayload } = eventPayload.payload;
      paymentId = rzpPaymentPayload.entity.id;
      rzpOrderId = rzpPaymentPayload.entity.order_id;
      const orderId = rzpPaymentPayload.entity.notes ? rzpPaymentPayload.entity.notes.orderId : null;

      if (orderId && orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId);
      }
      if (!order && rzpOrderId) {
        order = await Order.findOne({ 'paymentDetails.orderId': rzpOrderId });
      }
    }

    if (order) {
      await finalizeOrderPayment(order, paymentId);
    } else {
      console.warn(`Webhook received for event ${eventPayload.event} but no matching order was found.`);
    }
  }

  res.status(200).json({ success: true });
});

// @desc    Get current user's order history
// @route   GET /api/orders/my-orders
// @access  Private
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id }).sort('-createdAt');
  res.status(200).json(new ApiResponse(200, orders, 'Orders fetched successfully'));
});

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Public (Guest matches ID via session storage or order lookup) or Private (Checks ownership)
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'name slug images');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // If order is bound to a customer, protect ownership (unless requested by admin)
  if (order.user && (!req.user || (req.user.id !== order.user._id.toString() && req.user.role !== 'admin'))) {
    return next(new ApiError(403, 'Unauthorized to view this order details'));
  }

  res.status(200).json(new ApiResponse(200, order, 'Order fetched successfully'));
});

// @desc    Download PDF tax invoice
// @route   GET /api/orders/:id/invoice
// @access  Public (Guest/Logged in with validation)
exports.downloadInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Set response headers to direct PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);

  generatePDFInvoice(order, res);
});

// ================= ADMIN CONTROLLERS =================

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
exports.adminGetOrders = catchAsync(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const total = await Order.countDocuments();
  const orders = await Order.find()
    .populate('user', 'name email')
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  const pages = Math.ceil(total / limit);

  res.status(200).json(new ApiResponse(200, { orders, total, page, pages, limit }, 'All orders fetched'));
});

// @desc    Update Order Status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.adminUpdateStatus = catchAsync(async (req, res, next) => {
  const { status, comment } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  if (!status) {
    return next(new ApiError(400, 'Status field is required'));
  }

  order.orderStatus = status;
  order.trackingHistory.push({
    status,
    comment: comment || `Order status updated to ${status}`,
  });

  // Handle optional refund updates
  if (status === 'refunded') {
    order.paymentStatus = 'refunded';
    // refund stock quantities
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }
  }

  await order.save();

  res.status(200).json(new ApiResponse(200, order, `Order status updated to ${status} successfully`));
});

// @desc    Update Order Tracking Details
// @route   PUT /api/orders/:id/tracking
// @access  Private/Admin
exports.adminUpdateTracking = catchAsync(async (req, res, next) => {
  const { trackingId, carrier } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  order.trackingId = trackingId;
  if (trackingId) {
    order.trackingHistory.push({
      status: order.orderStatus,
      comment: `Tracking ID linked: ${trackingId} (Carrier: ${carrier || 'General Logistical Services'})`,
    });
  }

  await order.save();

  res.status(200).json(new ApiResponse(200, order, 'Tracking ID updated successfully'));
});
