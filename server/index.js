// DevX OS — Node server entry point (local dev + Render).
import app, { ready } from './app.js';

const PORT = process.env.PORT || 3000;

async function start() {
  await ready();              // creates schema + seeds on first boot (idempotent), loads account cache
  app.listen(PORT, () => console.log(`\n  DevX OS running → http://localhost:${PORT}\n`));
}
start().catch((e) => { console.error('Startup failed:', e); process.exit(1); });
