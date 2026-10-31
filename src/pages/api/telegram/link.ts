import type { APIRoute } from 'astro';
import { db } from '../../../db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '../../../lib/auth';
import { getTelegramBotUsername, getTelegramToken } from '../../../lib/server/telegram';

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UK-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const GET: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;
    const existingUsers = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (existingUsers.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let user = existingUsers[0];

    // If user is not connected and doesn't have a code, generate one
    if (!user.telegramChatId && !user.telegramLinkCode) {
      const newCode = generateRandomCode();
      await db.update(users).set({ telegramLinkCode: newCode }).where(eq(users.id, userId));
      user = { ...user, telegramLinkCode: newCode };
    }

    const botUsername = getTelegramBotUsername();
    const token = getTelegramToken();
    const isBotConfigured = !!token;

    let webhookInfo: { url?: string; hasWebhook?: boolean } = {};
    if (token) {
      try {
        const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const whData = await whRes.json();
        if (whData.ok) {
          webhookInfo = {
            url: whData.result.url || '',
            hasWebhook: Boolean(whData.result.url && whData.result.url.length > 0),
          };
        }
      } catch (e) {
        // ignore webhook check error
      }
    }

    return new Response(
      JSON.stringify({
        isLinked: !!user.telegramChatId,
        telegramUsername: user.telegramUsername || null,
        linkCode: user.telegramLinkCode,
        botUsername,
        isBotConfigured,
        webhook: webhookInfo,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;
    const body = await context.request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'unlink') {
      const newCode = generateRandomCode();
      await db
        .update(users)
        .set({
          telegramChatId: null,
          telegramUsername: null,
          telegramLinkCode: newCode,
        })
        .where(eq(users.id, userId));

      return new Response(
        JSON.stringify({
          success: true,
          isLinked: false,
          linkCode: newCode,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'generate_code') {
      const newCode = generateRandomCode();
      await db
        .update(users)
        .set({
          telegramLinkCode: newCode,
        })
        .where(eq(users.id, userId));

      return new Response(
        JSON.stringify({
          success: true,
          linkCode: newCode,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'set_webhook') {
      const token = getTelegramToken();
      if (!token) {
        return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN belum diatur di .env' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const webhookUrl = `${context.url.origin}/api/telegram/webhook`;
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();

      return new Response(
        JSON.stringify({
          success: data.ok,
          description: data.description,
          webhookUrl,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'delete_webhook') {
      const token = getTelegramToken();
      if (!token) {
        return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN belum diatur di .env' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const data = await res.json();

      return new Response(
        JSON.stringify({
          success: data.ok,
          description: data.description,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

