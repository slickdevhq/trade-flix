import mongoose from 'mongoose';
import logger from './logger.js';

let connection;

export const connectDB = async () => {
 // if (connection) return connection;

  try {
  //  mongoose.set('strictQuery'z, false);
  const url = process.env.MONGO_URI
   await mongoose.connect(url);

  } catch (err) {
    console.log(err)
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};