import express from 'express';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('name email phone address suspended createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const totals = await Order.aggregate([
      { $group: { _id: '$user', orderCount: { $sum: 1 }, totalSpend: { $sum: '$total' } } },
    ]);
    const totalsByUser = new Map(totals.map((item) => [String(item._id), item]));

    return res.json(customers.map((customer) => ({
      ...customer,
      ...(totalsByUser.get(String(customer._id)) || { orderCount: 0, totalSpend: 0 }),
    })));
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch customers' });
  }
});

router.patch('/:id/suspension', protect, adminOnly, async (req, res) => {
  const { suspended } = req.body;

  if (typeof suspended !== 'boolean') {
    return res.status(400).json({ message: 'Suspended must be true or false' });
  }

  try {
    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      { suspended },
      { new: true }
    ).select('name email phone address suspended createdAt');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update customer suspension' });
  }
});

export default router;