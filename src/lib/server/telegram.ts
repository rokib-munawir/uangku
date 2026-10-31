import { db } from '../../db';
import { users, transactions, savingsGoals } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseTransaction, parseReceiptImage } from './ai';

export function getTelegramToken(): string {
  return (
    (typeof import.meta.env !== 'undefined' && import.meta.env.TELEGRAM_BOT_TOKEN) ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  );
}

export function getTelegramBotUsername(): string {
  return (
    (typeof import.meta.env !== 'undefined' && import.meta.env.TELEGRAM_BOT_USERNAME) ||
    process.env.TELEGRAM_BOT_USERNAME ||
    'uangku_bot'
  );
}

export async function sendTelegramMessage(chatId: string | number, text: string, extra: Record<string, any> = {}) {
  const token = getTelegramToken();
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured.");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...extra,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram API error:", err);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send telegram message:", error);
    return false;
  }
}

// Utility: format currency to IDR
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Utility: visual text progress bar
export function generateProgressBar(current: number, target: number, length: number = 8): string {
  if (target <= 0) return '`[----------] 0%`';
  const percent = Math.min(Math.round((current / target) * 100), 100);
  const filled = Math.min(Math.round((percent / 100) * length), length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `<code>[${bar}] ${percent}%</code>`;
}

// Format local date YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Handle incoming Telegram update (from Webhook or Long-Polling)
 */
export async function handleTelegramUpdate(update: any) {
  const message = update?.message;
  if (!message) {
    return;
  }

  const chatId = String(message.chat.id);
  const text = message.text?.trim() || message.caption?.trim() || '';
  const fromUsername = message.from?.username || '';
  const fromFirstName = message.from?.first_name || 'Teman';
  const hasPhoto = Boolean(message.photo && message.photo.length > 0);
  const hasImageDoc = Boolean(message.document && message.document.mime_type?.startsWith('image/'));

  if (!text && !hasPhoto && !hasImageDoc) {
    return;
  }

  // 1. Check if Telegram user is already linked in users table
  const matchedUsers = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId))
    .limit(1);

  let currentUser = matchedUsers[0] || null;

  // 2. Handle /start or /link when user is NOT yet linked
  if (!currentUser) {
    // Check if user is trying to link with deep link /start <token> or /link <token|email>
    let linkCode = '';
    if (text.startsWith('/start ') || text.startsWith('/link ')) {
      linkCode = text.split(/\s+/)[1]?.trim() || '';
    }

    if (linkCode) {
      // Find user by telegramLinkCode or by email
      const potentialUsers = await db
        .select()
        .from(users)
        .where(
          linkCode.includes('@')
            ? eq(users.email, linkCode)
            : eq(users.telegramLinkCode, linkCode)
        )
        .limit(1);

      if (potentialUsers.length > 0) {
        const targetUser = potentialUsers[0];
        await db
          .update(users)
          .set({
            telegramChatId: chatId,
            telegramUsername: fromUsername || null,
            telegramLinkCode: null, // Reset code once linked
          })
          .where(eq(users.id, targetUser.id));

        const welcomeText = `🎉 <b>Selamat datang, ${targetUser.name}!</b>\n\n` +
          `Akun Telegram kamu berhasil terhubung dengan akun Uangku (<b>${targetUser.email}</b>).\n\n` +
          `✨ <b>Kamu sekarang bisa:</b>\n` +
          `• <b>Kirim Foto Struk:</b> Kirim foto bukti transfer / struk belanja, AI Vision langsung mencatatnya!\n` +
          `• <b>Catat Cepat:</b> Ketik santai, misal: <i>"Beli kopi susu 25rb"</i> atau <i>"Gaji bulanan 5jt"</i>\n` +
          `• <b>/saldo:</b> Cek saldo dan ringkasan keuangan saat ini\n` +
          `• <b>/laporan:</b> Lihat rekap pengeluaran & kategori transaksi\n` +
          `• <b>/budget:</b> Pantau batas anggaran & target tabungan\n` +
          `• <b>/bantuan:</b> Panduan lengkap perintah bot`;

        await sendTelegramMessage(chatId, welcomeText);
        return;
      } else {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Kode tautan atau email tidak ditemukan.</b>\n\n` +
          `Pastikan kode sesuai dengan yang tertera di menu <b>Profil Finansial</b> pada dashboard Uangku, atau hubungkan dengan perintah:\n` +
          `<code>/link email@kamu.com</code>`
        );
        return;
      }
    }

    // Default message for unlinked user
    const botUser = getTelegramBotUsername();
    const guestText = `👋 <b>Halo, ${fromFirstName}!</b>\n\n` +
      `Selamat datang di <b>Uangku Bot</b> — asisten pencatatan keuangan pribadi dengan kecerdasan buatan (AI).\n\n` +
      `🔒 <b>Akun Telegram kamu belum terhubung dengan akun Uangku.</b>\n\n` +
      `<b>Cara Menghubungkan:</b>\n` +
      `1. Masuk ke aplikasi Uangku di browser\n` +
      `2. Buka menu <b>Profil</b> (klik avatar di pojok kanan atas)\n` +
      `3. Lihat kode tautan Telegram Anda\n` +
      `4. Kirim ke bot ini:\n` +
      `   <code>/link &lt;KODE_TAUTAN&gt;</code>\n` +
      `Atau langsung hubungkan menggunakan email akun Anda:\n` +
      `   <code>/link email_anda@domain.com</code>`;

    await sendTelegramMessage(chatId, guestText);
    return;
  }

  // 3. User IS linked.
  // Check if user uploaded a photo of proof of payment / receipt
  if (hasPhoto || hasImageDoc) {
    await handleReceiptPhotoUpload(chatId, currentUser, message);
    return;
  }

  const lowerText = text.toLowerCase();

  // Command: /start or /bantuan or /help
  if (lowerText === '/start' || lowerText === '/bantuan' || lowerText === '/help') {
    const helpMsg = `🤖 <b>Halo, ${currentUser.name}!</b>\n\n` +
      `Berikut fitur & perintah yang bisa kamu gunakan di <b>Uangku Bot</b>:\n\n` +
      `🧾 <b>Unggah Bukti Pembayaran / Struk:</b>\n` +
      `Cukup kirimkan foto struk belanja, bukti transfer bank, atau nota kasir ke chat ini. AI Vision akan otomatis memindai total nominal, kategori, dan mencatatnya seketika!\n\n` +
      `💰 <b>/saldo</b>\n` +
      `Cek total saldo, total pemasukan, dan pengeluaran kamu saat ini.\n\n` +
      `📊 <b>/laporan</b>\n` +
      `Lihat laporan ringkasan transaksi bulan ini beserta breakdown per kategori.\n\n` +
      `🎯 <b>/budget</b>\n` +
      `Pantau batas belanja, target penghasilan, dan progres target tabungan.\n\n` +
      `✨ <b>Catat Cepat dengan AI Teks:</b>\n` +
      `Cukup ketik kalimat pengeluaran atau pemasukan sehari-hari:\n` +
      `• <i>"Makan siang ayam geprek 25.000"</i>\n` +
      `• <i>"Beli bensin 30rb cash"</i>\n` +
      `• <i>"Gaji bulan ini 6.000.000 transfer bca"</i>\n\n` +
      `⚙️ <b>Atur Anggaran Lewat Chat:</b>\n` +
      `• <code>/budget limit 3000000</code> (Ubah batas pengeluaran)\n` +
      `• <code>/budget target 10000000</code> (Ubah target pemasukan)\n` +
      `• <code>/unlink</code> (Putuskan akun Telegram)`;

    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // Command: /unlink
  if (lowerText === '/unlink') {
    await db
      .update(users)
      .set({
        telegramChatId: null,
        telegramUsername: null,
      })
      .where(eq(users.id, currentUser.id));

    await sendTelegramMessage(
      chatId,
      `👋 <b>Akun Telegram berhasil diputuskan dari Uangku.</b>\n` +
      `Kamu bisa menghubungkannya kembali kapan saja dengan perintah <code>/link &lt;email&gt;</code>.`
    );
    return;
  }

  // Command: /saldo
  if (lowerText === '/saldo') {
    await handleSaldoCommand(chatId, currentUser);
    return;
  }

  // Command: /laporan
  if (lowerText.startsWith('/laporan')) {
    await handleLaporanCommand(chatId, currentUser, text);
    return;
  }

  // Command: /budget
  if (lowerText.startsWith('/budget')) {
    await handleBudgetCommand(chatId, currentUser, text);
    return;
  }

  // 4. Natural Language Transaction via AI
  await handleNaturalLanguageTransaction(chatId, currentUser, text);
}

/**
 * /saldo command handler
 */
async function handleSaldoCommand(chatId: string, user: typeof users.$inferSelect) {
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id));

  const totalIncome = allTx
    .filter((t) => t.tipe === 'pemasukan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalExpense = allTx
    .filter((t) => t.tipe === 'pengeluaran')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalBalance = totalIncome - totalExpense;

  // Monthly stats
  const currentMonth = getCurrentMonthString();
  const monthlyIncome = allTx
    .filter((t) => t.tipe === 'pemasukan' && t.tanggal.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.nominal, 0);

  const monthlyExpense = allTx
    .filter((t) => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.nominal, 0);

  const expenseLimit = user.monthlyExpenseLimit || 0;
  const isOverLimit = expenseLimit > 0 && monthlyExpense > expenseLimit;

  let msg = `💳 <b>RINGKASAN SALDO ANDA</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Total Saldo:</b> <code>${formatIDR(totalBalance)}</code>\n\n` +
    `📈 <b>Total Pemasukan:</b> ${formatIDR(totalIncome)}\n` +
    `📉 <b>Total Pengeluaran:</b> ${formatIDR(totalExpense)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🗓️ <b>Bulan Ini (${currentMonth}):</b>\n` +
    `• Masuk: <b>+${formatIDR(monthlyIncome)}</b>\n` +
    `• Keluar: <b>-${formatIDR(monthlyExpense)}</b>\n`;

  if (expenseLimit > 0) {
    const sisa = expenseLimit - monthlyExpense;
    msg += `\n🎯 <b>Batas Belanja Bulanan:</b>\n` +
      `• Limit: ${formatIDR(expenseLimit)}\n` +
      `• Terpakai: ${generateProgressBar(monthlyExpense, expenseLimit)}\n` +
      `• Sisa: <b>${sisa >= 0 ? formatIDR(sisa) : '-' + formatIDR(Math.abs(sisa))}</b> ` +
      `${isOverLimit ? '⚠️ <i>(Melebihi Limit!)</i>' : '✅ <i>(Aman)</i>'}\n`;
  }

  msg += `\n💡 <i>Ketik nominal atau kalimat seperti "Makan siang 25rb" untuk mencatat transaksi.</i>`;

  await sendTelegramMessage(chatId, msg);
}

/**
 * /laporan command handler
 */
async function handleLaporanCommand(chatId: string, user: typeof users.$inferSelect, cmdText: string) {
  const currentMonth = getCurrentMonthString();
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(desc(transactions.tanggal), desc(transactions.id));

  // Filter transactions for this month
  const monthTx = allTx.filter((t) => t.tanggal.startsWith(currentMonth));

  const incomeTx = monthTx.filter((t) => t.tipe === 'pemasukan');
  const expenseTx = monthTx.filter((t) => t.tipe === 'pengeluaran');

  const totalIncome = incomeTx.reduce((sum, t) => sum + t.nominal, 0);
  const totalExpense = expenseTx.reduce((sum, t) => sum + t.nominal, 0);
  const netSavings = totalIncome - totalExpense;

  // Category breakdown for expenses
  const categoryMap: Record<string, number> = {};
  for (const tx of expenseTx) {
    categoryMap[tx.kategori] = (categoryMap[tx.kategori] || 0) + tx.nominal;
  }

  const categoryEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  let msg = `📊 <b>LAPORAN KEUANGAN BULAN INI</b>\n` +
    `Periode: <b>${currentMonth}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📈 <b>Pemasukan:</b> +${formatIDR(totalIncome)} (${incomeTx.length} tx)\n` +
    `📉 <b>Pengeluaran:</b> -${formatIDR(totalExpense)} (${expenseTx.length} tx)\n` +
    `💵 <b>Selisih Bersih:</b> <code>${netSavings >= 0 ? '+' : ''}${formatIDR(netSavings)}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (categoryEntries.length > 0) {
    msg += `🏷️ <b>Pengeluaran per Kategori:</b>\n`;
    for (const [cat, amt] of categoryEntries) {
      const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
      msg += `• <b>${cat}:</b> ${formatIDR(amt)} (<code>${pct}%</code>)\n`;
    }
    msg += `\n`;
  }

  // 5 Latest Transactions
  const latestTx = monthTx.slice(0, 5);
  if (latestTx.length > 0) {
    msg += `🕒 <b>5 Transaksi Terakhir:</b>\n`;
    for (const tx of latestTx) {
      const sign = tx.tipe === 'pemasukan' ? '🟢 +' : '🔴 -';
      msg += `${sign} <b>${formatIDR(tx.nominal)}</b> | ${tx.kategori}\n` +
        `  <i>${tx.catatan || '-'} (${tx.tanggal})</i>\n`;
    }
  } else {
    msg += `<i>Belum ada transaksi di bulan ini.</i>\n`;
  }

  msg += `\n📱 <i>Lihat grafik dan export lengkap di dashboard Uangku.</i>`;

  await sendTelegramMessage(chatId, msg);
}

/**
 * /budget command handler
 */
async function handleBudgetCommand(chatId: string, user: typeof users.$inferSelect, cmdText: string) {
  const parts = cmdText.split(/\s+/);

  // Subcommand: /budget limit <nominal>
  if (parts.length >= 3 && parts[1].toLowerCase() === 'limit') {
    const rawNum = parts[2].replace(/[.,]/g, '');
    const newLimit = parseFloat(rawNum);
    if (!isNaN(newLimit) && newLimit >= 0) {
      await db.update(users).set({ monthlyExpenseLimit: newLimit }).where(eq(users.id, user.id));
      await sendTelegramMessage(
        chatId,
        `✅ <b>Batas pengeluaran bulanan berhasil diubah!</b>\n` +
        `Batas baru: <b>${formatIDR(newLimit)}</b>`
      );
      return;
    }
  }

  // Subcommand: /budget target <nominal>
  if (parts.length >= 3 && parts[1].toLowerCase() === 'target') {
    const rawNum = parts[2].replace(/[.,]/g, '');
    const newTarget = parseFloat(rawNum);
    if (!isNaN(newTarget) && newTarget >= 0) {
      await db.update(users).set({ monthlyIncomeGoal: newTarget }).where(eq(users.id, user.id));
      await sendTelegramMessage(
        chatId,
        `✅ <b>Target pemasukan bulanan berhasil diubah!</b>\n` +
        `Target baru: <b>${formatIDR(newTarget)}</b>`
      );
      return;
    }
  }

  // Subcommand: /budget periode <mingguan|bulanan|tahunan>
  if (parts.length >= 3 && parts[1].toLowerCase() === 'periode') {
    const p = parts[2].toLowerCase();
    if (['mingguan', 'bulanan', 'tahunan'].includes(p)) {
      await db.update(users).set({ expenseLimitPeriod: p }).where(eq(users.id, user.id));
      await sendTelegramMessage(
        chatId,
        `✅ <b>Periode batas pengeluaran berhasil diubah menjadi ${p}!</b>`
      );
      return;
    }
  }

  // Default /budget overview display
  const currentMonth = getCurrentMonthString();
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id));

  const monthlyExpense = allTx
    .filter((t) => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.nominal, 0);

  const monthlyIncome = allTx
    .filter((t) => t.tipe === 'pemasukan' && t.tanggal.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.nominal, 0);

  // Fetch savings goals
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, user.id));

  const expenseLimit = user.monthlyExpenseLimit || 0;
  const incomeGoal = user.monthlyIncomeGoal || 0;
  const period = user.expenseLimitPeriod || 'bulanan';
  const remainingBudget = expenseLimit - monthlyExpense;
  const isOverLimit = expenseLimit > 0 && monthlyExpense > expenseLimit;

  let msg = `🎯 <b>PEMANTAUAN ANGGARAN & TARGET</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💸 <b>Batas Pengeluaran (${period}):</b>\n`;

  if (expenseLimit > 0) {
    msg += `• Terpakai: <b>${formatIDR(monthlyExpense)}</b> dari ${formatIDR(expenseLimit)}\n` +
      `• Progres: ${generateProgressBar(monthlyExpense, expenseLimit)}\n` +
      `• Sisa: <b>${remainingBudget >= 0 ? formatIDR(remainingBudget) : '-' + formatIDR(Math.abs(remainingBudget))}</b> ` +
      `${isOverLimit ? '🔴 <b>(MELEBIHI LIMIT!)</b>' : '🟢 <i>(Terkendali)</i>'}\n\n`;
  } else {
    msg += `<i>Belum ada batas pengeluaran yang diatur.</i>\n` +
      `Gunakan <code>/budget limit 3000000</code> untuk mengatur.\n\n`;
  }

  msg += `📈 <b>Target Pemasukan Bulanan:</b>\n`;
  if (incomeGoal > 0) {
    msg += `• Tercapai: <b>${formatIDR(monthlyIncome)}</b> dari ${formatIDR(incomeGoal)}\n` +
      `• Progres: ${generateProgressBar(monthlyIncome, incomeGoal)}\n\n`;
  } else {
    msg += `<i>Belum ada target pemasukan yang diatur.</i>\n` +
      `Gunakan <code>/budget target 10000000</code> untuk mengatur.\n\n`;
  }

  msg += `🏦 <b>Target Tabungan (Savings Goals):</b>\n`;
  if (goals.length > 0) {
    for (const g of goals) {
      msg += `• <b>${g.title}</b>\n` +
        `  ${formatIDR(g.currentAmount)} / ${formatIDR(g.targetAmount)} (${g.deadline})\n` +
        `  ${generateProgressBar(g.currentAmount, g.targetAmount)}\n`;
    }
  } else {
    msg += `<i>Belum ada target tabungan yang dibuat di dashboard.</i>\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `⚙️ <b>Perintah Pengaturan Cepat:</b>\n` +
    `• <code>/budget limit &lt;nominal&gt;</code>\n` +
    `• <code>/budget target &lt;nominal&gt;</code>\n` +
    `• <code>/budget periode &lt;mingguan|bulanan|tahunan&gt;</code>`;

  await sendTelegramMessage(chatId, msg);
}

/**
 * Handle natural language text using AI parser
 */
async function handleNaturalLanguageTransaction(
  chatId: string,
  user: typeof users.$inferSelect,
  text: string
) {
  try {
    // Call AI to parse message
    const parsed = await parseTransaction(text);

    const today = getTodayDateString();
    const txId = Date.now().toString();
    const txType = parsed.type === 'income' ? 'pemasukan' : 'pengeluaran';
    const txDate = parsed.date || today;

    const newTx = {
      id: txId,
      userId: user.id,
      nominal: parsed.amount,
      kategori: parsed.category,
      tanggal: txDate,
      catatan: parsed.description,
      tipe: txType,
    };

    // Save directly to transactions table
    await db.insert(transactions).values(newTx);

    // Calculate updated monthly status
    const currentMonth = getCurrentMonthString();
    const allUserTx = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id));

    const monthlyExpense = allUserTx
      .filter((t) => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.nominal, 0);

    const expenseLimit = user.monthlyExpenseLimit || 0;
    const isOverLimit = expenseLimit > 0 && monthlyExpense > expenseLimit;

    // Build friendly confirmation message
    const icon = txType === 'pemasukan' ? '💰' : '💸';
    const typeLabel = txType === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';

    let reply = `✅ <b>Transaksi Berhasil Dicatat!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${icon} <b>Jenis:</b> ${typeLabel}\n` +
      `🏷️ <b>Kategori:</b> ${parsed.category}\n` +
      `💵 <b>Nominal:</b> <b>${formatIDR(parsed.amount)}</b>\n` +
      `📝 <b>Catatan:</b> ${parsed.description}\n` +
      `💳 <b>Metode:</b> ${parsed.paymentMethod.replace('_', ' ').toUpperCase()}\n` +
      `📅 <b>Tanggal:</b> ${txDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;

    if (txType === 'pengeluaran' && expenseLimit > 0) {
      const sisa = expenseLimit - monthlyExpense;
      if (isOverLimit) {
        reply += `⚠️ <b>Peringatan:</b> Pengeluaran bulan ini (<b>${formatIDR(monthlyExpense)}</b>) telah melebihi batas (<b>${formatIDR(expenseLimit)}</b>)!\n`;
      } else {
        reply += `🛡️ <b>Sisa Anggaran Belanja Bulan Ini:</b> <b>${formatIDR(sisa)}</b>\n`;
      }
    }

    reply += `\n🔍 <i>Ketik /saldo untuk cek saldo total atau /budget untuk cek anggaran.</i>`;

    await sendTelegramMessage(chatId, reply);
  } catch (error: any) {
    console.error("AI Telegram parse error:", error);
    await sendTelegramMessage(
      chatId,
      `❓ <b>Tidak dapat mendeteksi transaksi.</b>\n\n` +
      `<i>Pesan: "${text}"</i>\n\n` +
      `💡 <b>Tips Penulisan:</b>\n` +
      `Pastikan menyertakan nominal transaksi, contoh:\n` +
      `• <i>"Beli sate 25.000"</i>\n` +
      `• <i>"Ngopi 20rb"</i>\n` +
      `• <i>"Gaji 5jt transfer bca"</i>\n\n` +
      `Gunakan /bantuan untuk melihat panduan lengkap.`
    );
  }
}

/**
 * Handle proof of payment / receipt photo upload from Telegram
 */
async function handleReceiptPhotoUpload(
  chatId: string,
  user: typeof users.$inferSelect,
  message: any
) {
  const token = getTelegramToken();
  if (!token) return;

  await sendTelegramMessage(chatId, `⏳ <i>Sedang menganalisis bukti pembayaran dengan AI Vision...</i>`);

  try {
    // 1. Get file ID from photo (highest resolution) or document
    const fileId = message.photo && message.photo.length > 0
      ? message.photo[message.photo.length - 1].file_id
      : message.document?.file_id;

    if (!fileId) {
      throw new Error("File foto tidak valid.");
    }

    // 2. Query Telegram Bot API for filePath
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      throw new Error("Gagal mengambil file foto dari Telegram.");
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    // 3. Download image and convert to Base64 Data URI
    const imgFetch = await fetch(downloadUrl);
    const arrayBuf = await imgFetch.arrayBuffer();
    const base64Str = Buffer.from(arrayBuf).toString('base64');
    const mimeType = imgFetch.headers.get('content-type') || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Str}`;

    // 4. Pass to parseReceiptImage
    const caption = message.caption || '';
    const parsed = await parseReceiptImage(dataUri, caption);

    const today = getTodayDateString();
    const txId = Date.now().toString();
    const txType = parsed.type === 'income' ? 'pemasukan' : 'pengeluaran';
    const txDate = parsed.date || today;

    const newTx = {
      id: txId,
      userId: user.id,
      nominal: parsed.amount,
      kategori: parsed.category,
      tanggal: txDate,
      catatan: parsed.description || 'Bukti Pembayaran',
      tipe: txType,
      buktiPembayaran: dataUri,
    };

    // 5. Insert directly to database
    await db.insert(transactions).values(newTx);

    // 6. Check budget limits
    const currentMonth = getCurrentMonthString();
    const allUserTx = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id));

    const monthlyExpense = allUserTx
      .filter((t) => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.nominal, 0);

    const expenseLimit = user.monthlyExpenseLimit || 0;
    const isOverLimit = expenseLimit > 0 && monthlyExpense > expenseLimit;

    const icon = txType === 'pemasukan' ? '💰' : '🧾';
    const typeLabel = txType === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';

    let reply = `🧾 <b>Bukti Pembayaran Berhasil Dipindai & Dicatat!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${icon} <b>Jenis:</b> ${typeLabel}\n` +
      `🏷️ <b>Kategori:</b> ${parsed.category}\n` +
      `💵 <b>Total Nominal:</b> <b>${formatIDR(parsed.amount)}</b>\n` +
      `📝 <b>Keterangan:</b> ${parsed.description}\n` +
      `💳 <b>Metode:</b> ${parsed.paymentMethod.replace('_', ' ').toUpperCase()}\n` +
      `📅 <b>Tanggal:</b> ${txDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📸 <i>Foto bukti pembayaran berhasil disimpan ke riwayat transaksi Uangku.</i>\n`;

    if (txType === 'pengeluaran' && expenseLimit > 0) {
      const sisa = expenseLimit - monthlyExpense;
      if (isOverLimit) {
        reply += `\n⚠️ <b>Peringatan:</b> Pengeluaran bulan ini (<b>${formatIDR(monthlyExpense)}</b>) telah melebihi batas anggaran (<b>${formatIDR(expenseLimit)}</b>)!\n`;
      } else {
        reply += `\n🛡️ <b>Sisa Batas Belanja Bulan Ini:</b> <b>${formatIDR(sisa)}</b>\n`;
      }
    }

    reply += `\n🔍 <i>Ketik /saldo untuk cek saldo total atau /budget untuk cek anggaran.</i>`;

    await sendTelegramMessage(chatId, reply);
  } catch (err: any) {
    console.error("Receipt upload processing error:", err);
    await sendTelegramMessage(
      chatId,
      `⚠️ <b>Gagal membaca bukti pembayaran.</b>\n\n` +
      `Alasan: <i>${err.message || 'Format gambar atau teks tidak terbaca.'}</i>\n\n` +
      `💡 <b>Tips:</b>\n` +
      `• Pastikan foto struk/bukti transfer terang, fokus, dan nominal total terlihat jelas.\n` +
      `• Atau kamu juga bisa mengirim foto disertai caption (keterangan), misal: <i>"Makan siang 45rb"</i>.`
    );
  }
}

