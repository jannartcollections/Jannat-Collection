import express from 'express';
import SystemConfig, { defaultSystemConfig } from '../models/SystemConfig.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

const getOrCreateDefaultConfig = async () => {
  try {
    let config = await SystemConfig.findOne({ key: 'default' });
    if (!config) {
      config = await SystemConfig.create(defaultSystemConfig);
    }
    return config;
  } catch (error) {
    console.error('Failed to get or create default config:', error);
    return null;
  }
};

router.get('/public', async (req, res) => {
  try {
    const config = await getOrCreateDefaultConfig();
    if (!config) {
      return res.json(defaultSystemConfig);
    }
    
    const publicConfig = {
      storeName: config.storeName,
      logoUrl: config.logoUrl,
      tagline: config.tagline,
      currency: config.currency,
      contactEmail: config.contactEmail,
      phone: config.phone,
      address: config.address,
      supportHours: config.supportHours,
      shippingMessage: config.shippingMessage,
      returnWindowDays: config.returnWindowDays,
      newsletterEnabled: config.newsletterEnabled,
      categories: Array.isArray(config.categories) && config.categories.length
        ? config.categories
        : defaultSystemConfig.categories,
      socialLinks: config.socialLinks,
    };
    
    return res.json(publicConfig);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch configuration' });
  }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const config = await getOrCreateDefaultConfig();
    if (!config) {
      return res.json(defaultSystemConfig);
    }
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch configuration' });
  }
});

router.patch('/', protect, adminOnly, async (req, res) => {
  const allowedFields = [
    'storeName',
    'logoUrl',
    'tagline',
    'currency',
    'contactEmail',
    'phone',
    'address',
    'supportHours',
    'shippingMessage',
    'returnWindowDays',
    'newsletterEnabled',
    'categories',
    'socialLinks',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) {
      if (field === 'categories' && Array.isArray(req.body.categories)) {
        updates[field] = [...new Set(req.body.categories.map((item) => String(item).trim()).filter(Boolean))];
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  try {
    const config = await getOrCreateDefaultConfig();
    if (!config) {
      return res.status(500).json({ message: 'Failed to initialize configuration' });
    }

    const updatedConfig = await SystemConfig.findByIdAndUpdate(
      config._id,
      updates,
      { new: true, runValidators: true }
    );

    return res.json(updatedConfig);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to update configuration' });
  }
});

export default router;
