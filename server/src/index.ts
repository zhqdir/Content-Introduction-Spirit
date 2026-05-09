import express from "express";
import cors from "cors";
import ttsRoutes from "./routes/tts";
import llmRoutes from "./routes/llm";
import fetchRoutes from "./routes/fetch";
import userRoutes from "./routes/user";
import paymentRoutes from "./routes/payment";
import adminRoutes from "./routes/admin";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
