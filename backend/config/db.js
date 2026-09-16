import mongoose from 'mongoose';
import { setDbAvailable } from '../services/dataService.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jannat-collection';

  try {
    await mongoose.connect(mongoUri);
    setDbAvailable(true);
    console.log('MongoDB connected successfully');
  } catch (error) {
    setDbAvailable(false);
    console.error('MongoDB connection failed:', error.message);
    console.log('Continuing without MongoDB for local mock setup.');
  }
};

export default connectDB;
