import express from 'express';
import pino from 'pino';
import { proxyRouter } from './routes/proxy';

const logger = pino({ name: 'proxy-router' });
const app = express();

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/v1/proxy', proxyRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'proxy-router' });
});

const PORT = process.env.PORT || 8008;
app.listen(PORT, () => {
  logger.info(`Proxy Router listening on port ${PORT}`);
});
