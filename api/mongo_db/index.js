import mongoose from 'mongoose';

/**
 * Establishes a connection to a MongoDB database using Mongoose.
 *
 * @async
 * @function connectToDatabase
 * @param {string} uri - MongoDB connection URI (e.g., "mongodb://localhost:27017/mydb").
 * @returns {Promise<void>} Resolves when the connection is successful.
 *
 * @example
 * import { connectToDatabase } from './db.js';
 * await connectToDatabase(process.env.MONGO_URI);
 */
async function connectToDatabase(uri) {
    try {
        await mongoose.connect(uri);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

export { connectToDatabase };