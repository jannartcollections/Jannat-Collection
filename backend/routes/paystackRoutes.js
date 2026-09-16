import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

const paystackRequest = async (path, options = {}) => {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Paystack request failed');
  }
  return data.data;
};

const calculateOrder = async (items) => {
  if (!Array.isArray(items) || !items.length) throw new Error('At least one item is required');
  const products = await Product.find({ _id: { $in: items.map((item) => item.productId) }, isActive: true });
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const normalizedItems = items.map((item) => {
    const product = productMap.get(String(item.productId));
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
      throw new Error('One or more products are unavailable');
    }
    return { productId: product._id, name: product.name, price: product.price, quantity };
  });
  const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items: normalizedItems, total };
};

router.post('/initialize', optionalProtect, async (req, res) => {
  const { email, customer, items } = req.body;

  if (!email || !customer?.name || !customer?.phone || !customer?.address) {
    return res.status(400).json({ message: 'Email and amount are required' });
  }

  if (!process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY.startsWith('your_')) {
    return res.status(503).json({ message: 'Paystack is not configured' });
  }

  try {
    const orderData = await calculateOrder(items);
    const paymentAmount = Math.round(orderData.total * 100);
    const order = await Order.create({
      user: req.user?._id || null,
      customer: { ...customer, email: email.trim().toLowerCase() },
      ...orderData,
      total: orderData.total,
      paymentAmount,
      paymentCurrency: 'NGN',
    });
    const payment = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        amount: paymentAmount,
        currency: 'NGN',
        callback_url: `${(process.env.PAYSTACK_CALLBACK_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}/payment/callback`,
        metadata: { orderId: String(order._id) },
      }),
    });
    order.paymentReference = payment.reference;
    await order.save();
    return res.status(201).json({ authorization_url: payment.authorization_url, reference: payment.reference, orderId: order._id });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Payment initialization failed' });
  }
});

router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({ message: 'Payment reference is required' });
  }

  try {
    const payment = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const order = await Order.findOne({ paymentReference: payment.reference });
    if (!order || payment.currency !== order.paymentCurrency || Number(payment.amount) !== order.paymentAmount) {
      return res.status(400).json({ message: 'Payment details do not match the order' });
    }
    if (payment.status === 'success') {
      order.paymentStatus = 'paid';
      order.status = 'paid';
      await order.save();
    }
    return res.json({ verified: payment.status === 'success', order });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Payment verification failed' });
  }
});

router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').update(req.rawBody || '').digest('hex');
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.sendStatus(401);
  const { event, data } = req.body;
  if (['charge.success', 'charge.failed'].includes(event) && data?.reference) {
    const order = await Order.findOne({ paymentReference: data.reference });
    if (order && data.currency === order.paymentCurrency && Number(data.amount) === order.paymentAmount) {
      order.paymentStatus = event === 'charge.success' ? 'paid' : 'failed';
      if (event === 'charge.success') order.status = 'paid';
      await order.save();
    }
  }
  return res.sendStatus(200);
});

export default router;
