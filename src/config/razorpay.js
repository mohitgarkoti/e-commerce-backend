const Razorpay = require('razorpay');
const crypto = require('crypto');

const isMock = process.env.RAZORPAY_KEY_ID === 'rzp_test_mockKeyId12345' || !process.env.RAZORPAY_KEY_ID;

let razorpay = null;

if (!isMock) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const createOrder = async (amount, receipt) => {
  if (isMock || !razorpay) {
    // Generate a mock Razorpay order
    return {
      id: `order_mock_${Math.random().toString(36).substring(2, 12)}`,
      entity: 'order',
      amount: Math.round(amount * 100), // convert to paisa
      amount_paid: 0,
      amount_due: Math.round(amount * 100),
      currency: 'INR',
      receipt: receipt,
      status: 'created',
      created_at: Math.floor(Date.now() / 1000)
    };
  } else {
    const options = {
      amount: Math.round(amount * 100), // in paisa
      currency: 'INR',
      receipt: receipt,
    };
    return await razorpay.orders.create(options);
  }
};

const verifyPayment = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (isMock || razorpayOrderId.startsWith('order_mock_')) {
    return true; // Mock verification always succeeds
  }
  
  const text = razorpayOrderId + '|' + razorpayPaymentId;
  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
    
  return generated_signature === signature;
};

module.exports = {
  razorpay,
  createOrder,
  verifyPayment,
  isMock
};
