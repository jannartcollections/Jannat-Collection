import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Ensure uploads directory exists for local fallback
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const decodeBase64Image = (file) => {
  if (!file || typeof file !== 'string') {
    throw new Error('File data is required');
  }

  if (file.startsWith('data:')) {
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  if (file.startsWith('/9j/') || file.match(/^[A-Za-z0-9+/=]+$/)) {
    return Buffer.from(file, 'base64');
  }

  return Buffer.from(file);
};

router.post('/', async (req, res) => {
  try {
    const { file, filename } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'File data is required' });
    }

    if (isCloudinaryConfigured) {
      const uploadResult = await cloudinary.uploader.upload(
        `data:image/png;base64,${decodeBase64Image(file).toString('base64')}`,
        {
          folder: 'jannat-collection',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
          public_id: filename ? filename.replace(/\.[^/.]+$/, '') : undefined,
        }
      );

      return res.status(201).json({
        message: 'Image uploaded successfully',
        url: uploadResult.secure_url,
        filename: uploadResult.public_id,
        storage: 'cloudinary',
      });
    }

    const timestamp = Date.now();
    const finalFilename = filename || `image-${timestamp}.jpg`;
    const uniqueFilename = `${timestamp}-${finalFilename.replace(/\s+/g, '-')}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    const buffer = decodeBase64Image(file);

    fs.writeFileSync(filePath, buffer);

    return res.status(201).json({
      message: 'Image uploaded successfully',
      url: `/uploads/${uniqueFilename}`,
      filename: uniqueFilename,
      storage: 'local',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: error.message || 'Upload failed' });
  }
});

export default router;
