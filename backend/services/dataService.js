import Product from '../models/Product.js';

let inMemoryProducts = [];

let dbAvailable = false;

export const setDbAvailable = (available) => {
  dbAvailable = available;
};

export const getAllProducts = async () => {
  try {
    if (dbAvailable) {
      return await Product.find({ isActive: true }).sort({ createdAt: -1 });
    }
  } catch (error) {
    console.log('DB unavailable, using in-memory data');
  }
  return inMemoryProducts;
};

export const getProductById = async (id) => {
  try {
    if (dbAvailable) {
      return await Product.findById(id);
    }
  } catch (error) {
    console.log('DB unavailable, using in-memory data');
  }
  return inMemoryProducts.find((p) => p._id === id);
};

export const createProduct = async (productData) => {
  try {
    if (dbAvailable) {
      return await Product.create(productData);
    }
  } catch (error) {
    console.log('DB unavailable, using in-memory data');
  }
  const newProduct = { _id: Date.now().toString(), ...productData };
  inMemoryProducts.push(newProduct);
  return newProduct;
};

export const updateProduct = async (id, productData) => {
  try {
    if (dbAvailable) {
      return await Product.findByIdAndUpdate(id, productData, { new: true });
    }
  } catch (error) {
    console.log('DB unavailable, using in-memory data');
  }
  const index = inMemoryProducts.findIndex((p) => p._id === id);
  if (index >= 0) {
    inMemoryProducts[index] = { ...inMemoryProducts[index], ...productData };
    return inMemoryProducts[index];
  }
  return null;
};

export const deleteProduct = async (id) => {
  try {
    if (dbAvailable) {
      return await Product.findByIdAndDelete(id);
    }
  } catch (error) {
    console.log('DB unavailable, using in-memory data');
  }
  const index = inMemoryProducts.findIndex((p) => p._id === id);
  if (index >= 0) {
    const deleted = inMemoryProducts[index];
    inMemoryProducts.splice(index, 1);
    return deleted;
  }
  return null;
};
