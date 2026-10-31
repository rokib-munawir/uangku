import 'dotenv/config';
import { getTelegramToken, handleTelegramUpdate } from '../lib/server/telegram';

async function startPolling() {
  const token = getTelegramToken();
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env!');
    console.log('👉 Please set TELEGRAM_BOT_TOKEN in .env and rerun this script.');
    process.exit(1);
  }

  console.log('🤖 Getting bot profile...');
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      console.error('❌ Failed to connect to Telegram API:', meData.description);
      process.exit(1);
    }

    console.log(`✅ Connected as @${meData.result.username} (${meData.result.first_name})`);

    // Remove any active webhook so getUpdates works
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    console.log('🚀 Telegram polling runner started! Waiting for messages...');
    console.log('Commands available: /saldo, /laporan, /budget, /bantuan, /unlink, or chat natural language to record transactions.');

    let offset = 0;
    while (true) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            console.log(`📩 Received update #${update.update_id} from ${update.message?.from?.first_name || 'unknown'}: "${update.message?.text || ''}"`);
            await handleTelegramUpdate(update);
          }
        } else if (!data.ok) {
          console.warn('⚠️ Telegram getUpdates warning:', data.description);
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (err: any) {
        console.error('⚠️ Polling network error:', err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  } catch (error: any) {
    console.error('Fatal bot error:', error.message);
    process.exit(1);
  }
}

startPolling();

