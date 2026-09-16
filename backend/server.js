import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { verifySmtpConnection } from './services/mailService.js';
import authRoutes, { ensureDefaultAdmin } from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import paystackRoutes from './routes/paystackRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import configRoutes from './routes/configRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const startServer = (port) => {
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        process.env.ADMIN_URL || 'http://localhost:5174',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`);
  });
};

const preferredPort = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  },
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const initializeApp = async () => {
  startServer(preferredPort);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Jannat Collection backend is running',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/paystack', paystackRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/config', configRoutes);

  await connectDB();
  await ensureDefaultAdmin();
  await verifySmtpConnection();
};

initializeApp();
