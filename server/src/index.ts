import express from "express";
import cors from "cors";
import path from 'path';
import { fileURLToPath } from 'url';
import ttsRoutes from "./routes/tts";
import llmRoutes from "./routes/llm";
import fetchRoutes from "./routes/fetch";
import userRoutes from "./routes/user";
import paymentRoutes from "./routes/payment";
import adminRoutes from "./routes/admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 托管前端静态文件
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Health check
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/tts', ttsRoutes);
app.use('/api/v1/llm', llmRoutes);
app.use('/api/v1/fetch', fetchRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// 所有非 API 路由返回前端页面（SPA 支持）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});