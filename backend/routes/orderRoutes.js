import express from 'express';
import Order from '../models/Order.js';
import { protect, optionalProtect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch orders' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'name email');
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch all orders' });
  }
});

router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  const { status, paymentStatus } = req.body;
  const allowedStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid order status' });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...(status ? { status } : {}), ...(paymentStatus ? { paymentStatus } : {}) },
      { new: true }
    ).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update order' });
  }
});

router.post('/', optionalProtect, async (req, res) => {
  const { items, total, paymentReference, customer } = req.body;

  if (!items || !items.length || !total) {
    return res.status(400).json({ message: 'Items and total are required' });
  }

  if (!customer?.name || !customer?.email || !customer?.phone || !customer?.address) {
    return res.status(400).json({ message: 'Name, email, phone and delivery address are required' });
  }

  try {
    const order = await Order.create({
      user: req.user?._id || null,
      customer,
      items,
      total,
      paymentReference: paymentReference || '',
      paymentStatus: 'pending',
      status: 'pending',
    });

    return res.status(201).json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Order creation failed' });
  }
});

export default router;
