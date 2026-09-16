import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Simple file upload endpoint - accepts base64 or binary
router.post('/', (req, res) => {
  try {
    const { file, filename } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'File data is required' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const finalFilename = filename || `image-${timestamp}.jpg`;
    const uniqueFilename = `${timestamp}-${finalFilename.replace(/\s+/g, '-')}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Decode base64 if needed
    let buffer;
    if (file.startsWith('data:')) {
      // It's a data URL
      const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else if (file.startsWith('/9j/') || file.match(/^[A-Za-z0-9+/=]+$/)) {
      // It's base64 encoded
      buffer = Buffer.from(file, 'base64');
    } else {
      buffer = Buffer.from(file);
    }

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Return relative URL
    const imageUrl = `/uploads/${uniqueFilename}`;

    return res.status(201).json({
      message: 'Image uploaded successfully',
      url: imageUrl,
      filename: uniqueFilename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: error.message || 'Upload failed' });
  }
});

export default router;
