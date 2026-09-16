import mongoose from 'mongoose';

export const defaultSystemConfig = {
  key: 'default',
  storeName: 'Jannat Collection',
  logoUrl: '/Brand-logo.jpg',
  tagline: 'Curated fashion for confident living, refined style, and everyday elegance.',
  currency: 'USD',
  contactEmail: 'hello@jannatcollection.com',
  phone: '+234 800 000 0000',
  address: 'Lagos, Nigeria',
  supportHours: 'Monday - Friday, 9:00 AM - 5:00 PM',
  shippingMessage: 'Orders are carefully prepared within 1 to 3 business days. Standard delivery usually arrives within 3 to 7 business days.',
  returnWindowDays: 14,
  newsletterEnabled: true,
  categories: ['Lace', 'Atampa', 'Passion', 'Shadda', 'Cotton', 'Hijab', 'Abaya'],
  socialLinks: {
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    tiktok: 'https://tiktok.com',
    pinterest: 'https://pinterest.com',
  },
};

const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    storeName: { type: String, required: true, trim: true, maxlength: 100 },
    logoUrl: { type: String, trim: true, maxlength: 500 },
    tagline: { type: String, trim: true, maxlength: 240 },
    currency: { type: String, required: true, uppercase: true, trim: true, maxlength: 5 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 240 },
    supportHours: { type: String, trim: true, maxlength: 160 },
    shippingMessage: { type: String, trim: true, maxlength: 500 },
    returnWindowDays: { type: Number, min: 0, max: 365 },
    newsletterEnabled: { type: Boolean, default: true },
    categories: {
      type: [String],
      default: ['Lace', 'Atampa', 'Passion', 'Shadda', 'Cotton', 'Hijab', 'Abaya'],
      validate: {
        validator: (value) => Array.isArray(value) && value.every((item) => String(item).trim().length > 0),
        message: 'Categories must be a list of non-empty strings',
      },
    },
    socialLinks: {
      instagram: { type: String, trim: true, maxlength: 500 },
      facebook: { type: String, trim: true, maxlength: 500 },
      tiktok: { type: String, trim: true, maxlength: 500 },
      pinterest: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true }
);

const SystemConfig = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
