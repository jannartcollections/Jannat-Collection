import express from 'express';
import { optionalProtect, protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

const complaints = [];

router.get('/', protect, (req, res) => {
  return res.json(complaints);
});

router.get('/my-complaints', protect, (req, res) => {
  const userComplaints = complaints.filter((complaint) => String(complaint.user) === String(req.user._id));
  return res.json(userComplaints);
});

router.post('/', optionalProtect, (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: 'Subject and message are required' });
  }

  if (!req.user && (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email?.trim()))) {
    return res.status(400).json({ message: 'Name and a valid email are required' });
  }

  const complaint = {
    id: Date.now(),
    user: req.user?._id || null,
    name: req.user?.name || name.trim(),
    email: req.user?.email || email.trim().toLowerCase(),
    subject: subject.trim().slice(0, 160),
    message: message.trim().slice(0, 4000),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  complaints.unshift(complaint);
  return res.status(201).json({ message: 'Complaint submitted successfully', complaint });
});

router.patch('/:id/status', protect, adminOnly, (req, res) => {
  const { status } = req.body;
  const complaint = complaints.find((item) => String(item.id) === String(req.params.id));

  if (!complaint) {
    return res.status(404).json({ message: 'Complaint not found' });
  }

  if (!['open', 'in review', 'resolved'].includes(status)) {
    return res.status(400).json({ message: 'Invalid complaint status' });
  }

  complaint.status = status;
  return res.json(complaint);
});

export default router;
