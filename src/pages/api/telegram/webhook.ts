import type { APIRoute } from 'astro';
import { handleTelegramUpdate, getTelegramToken } from '../../../lib/server/telegram';

export const POST: APIRoute = async ({ request }) => {
  try {
    const update = await request.json();
    // Process the update asynchronously without blocking webhook timeout
    await handleTelegramUpdate(update);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200, // Return 200 so Telegram does not aggressively retry failed user commands
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  const token = getTelegramToken();
  if (!token) {
    return new Response(JSON.stringify({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured in .env'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if setup parameter is passed: /api/telegram/webhook?setWebhook=true
  if (url.searchParams.get('setWebhook') === 'true') {
    try {
      const webhookUrl = `${url.origin}/api/telegram/webhook`;
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, result: data, webhookUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({
    configured: true,
    message: 'Telegram webhook endpoint ready. Use POST for updates, or ?setWebhook=true to register.'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

