// Mini service: reads bot token from DB and calls Telegram setWebhook API
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';

const db = new PrismaClient();
const PORT = 3031;

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url?.includes('/set-webhook')) {
    try {
      const bot = await db.telegramBot.findFirst();
      if (!bot || !bot.botToken || bot.botToken.startsWith('PLACEHOLDER')) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Bot token not configured or is placeholder' }));
        return;
      }

      // Resolve the webhook URL from (in priority order): an explicit
      // ?url= query param, the PUBLIC_BASE_URL env var, or the URL already
      // stored on the bot record. Previously this was hardcoded to a
      // one-off dev-preview domain (space-z.ai) that the real deployment
      // never owned, so Telegram updates were silently sent nowhere —
      // that was the root cause of "the bot doesn't respond".
      const reqUrl = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      const overrideUrl = reqUrl.searchParams.get('url');
      const base = overrideUrl || process.env.PUBLIC_BASE_URL || bot.webhookUrl?.replace(/\/api\/v1\/integrations\/telegram\/webhook$/, '');
      if (!base) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'No webhook URL available. Pass ?url=https://your-domain.com or set PUBLIC_BASE_URL.' }));
        return;
      }
      const webhookUrl = base.includes('/api/v1/integrations/telegram/webhook')
        ? base
        : `${base.replace(/\/$/, '')}/api/v1/integrations/telegram/webhook`;
      console.log('Setting webhook to:', webhookUrl);
      console.log('Bot token starts with:', bot.botToken.slice(0, 10) + '...');

      const tgRes = await fetch(`https://api.telegram.org/bot${bot.botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: bot.webhookSecret || undefined,
        }),
      });

      const tgData = await tgRes.json();
      console.log('Telegram response:', JSON.stringify(tgData));

      if (tgData.ok) {
        await db.telegramBot.update({
          where: { id: bot.id },
          data: { webhookUrl, status: 'CONNECTED' },
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, webhookUrl, telegramResponse: tgData }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: tgData.description, telegramResponse: tgData }));
      }
    } catch (e) {
      console.error('Error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'Set-webhook service running. Access /set-webhook to set the webhook.' }));
  }
});

server.listen(PORT, () => {
  console.log(`Set-webhook service running on port ${PORT}`);
});
