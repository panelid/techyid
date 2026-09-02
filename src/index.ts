import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Door.id v6 Worker is running!'));

app.get('/api/health', (c) => c.json({ status: 'healthy', stack: 'Cloudflare Workers + D1' }));

export default app;
