import express from 'express';
import { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../services/dataService.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const products = await getAllProducts();
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch product' });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  const { name, description, price, category, stock, images, featured, sizes, colors } = req.body;

  if (!name || !description || !price || !category) {
    return res.status(400).json({ message: 'Name, description, price and category are required' });
  }

  try {
    const product = await createProduct({
      name,
      description,
      price,
      category,
      stock: stock || 0,
      images: images || [],
      featured: Boolean(featured),
      sizes: sizes || [],
      colors: colors || [],
      isActive: true,
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Product creation failed' });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Product update failed' });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await deleteProduct(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Product deletion failed' });
  }
});

export default router;
