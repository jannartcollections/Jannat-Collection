import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const DEFAULT_ADMIN = {
  name: 'Admin User',
  email: 'admin@jannatcollection.com',
  password: 'admin123',
  role: 'admin',
};

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'jannat-secret-key', {
    expiresIn: '7d',
  });

export const ensureDefaultAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
      await User.create({
        name: DEFAULT_ADMIN.name,
        email: DEFAULT_ADMIN.email.toLowerCase(),
        password: hashedPassword,
        role: DEFAULT_ADMIN.role,
      });
      console.log('Default admin created:', DEFAULT_ADMIN.email);
    }
  } catch (error) {
    console.error('Failed to ensure default admin user:', error.message);
  }
};

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'customer' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        role: user.role,
      },
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.suspended) {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        role: user.role,
      },
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jannat-secret-key');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

router.patch('/profile', protect, async (req, res) => {
  const { name, phone, address, avatar } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim(), phone: phone?.trim() || '', address: address?.trim() || '', avatar: avatar || '' },
      { new: true, runValidators: true }
    ).select('-password');

    return res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
});

export default router;
