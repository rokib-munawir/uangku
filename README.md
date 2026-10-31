<div align="center">

# 💰 Uangku

**Aplikasi manajemen keuangan pribadi yang cerdas — didukung AI & Telegram**

[![Astro](https://img.shields.io/badge/Astro-5.x-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://mysql.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

[🚀 Demo](#) · [📖 Dokumentasi](#getting-started) · [🐛 Lapor Bug](../../issues)

</div>

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
| 🤖 **AI Transaction Parser** | Catat transaksi cukup dengan kalimat biasa seperti *"Beli nasi goreng 20 ribu"* |
| 📷 **Scan Struk / Bukti Transfer** | Upload foto struk atau bukti transfer — AI membaca dan langsung mencatat |
| 🤖 **Telegram Bot** | Kelola keuangan langsung dari Telegram dengan perintah `/saldo`, `/laporan`, `/budget` |
| 📊 **Dashboard Interaktif** | Ringkasan pemasukan & pengeluaran, grafik tren, dan kategori pengeluaran |
| 🎯 **Budgeting** | Tetapkan anggaran per kategori dan pantau realisasinya |
| 🏦 **Tabungan & Goals** | Buat target tabungan dan lacak kemajuannya |
| 📤 **Export Data** | Export riwayat transaksi ke CSV/PDF |
| 🔐 **Autentikasi** | Login via Google OAuth atau email/password (Better Auth) |
| 🌙 **Dark Mode** | Tampilan gelap / terang yang nyaman di mata |

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Framework** | [Astro.js](https://astro.build) (SSR, Vercel adapter) |
| **UI** | [React 19](https://react.dev) + [Tailwind CSS v4](https://tailwindcss.com) |
| **Database** | MySQL 8 via [Drizzle ORM](https://orm.drizzle.team) |
| **Auth** | [Better Auth](https://better-auth.com) (Google OAuth + Email) |
| **AI** | [OpenRouter API](https://openrouter.ai) — `recursive/flint-v1.0:free` (text) + `nvidia/nemotron-3.5-super-vl:free` (vision) |
| **Bot** | Telegram Bot API (Webhook mode di production, Polling mode di lokal) |
| **Deployment** | [Vercel](https://vercel.com) (serverless) |

---

## 📁 Struktur Proyek

```text
uangku/
├── public/                    # Aset statis
├── src/
│   ├── components/
│   │   ├── dashboard/         # Dashboard, ProfileModal (Telegram settings)
│   │   └── transaction/       # AddTransactionModal (AI input), dll.
│   ├── db/
│   │   ├── schema.ts          # Drizzle ORM schema
│   │   └── migrations/        # SQL migration files
│   ├── lib/
│   │   └── server/
│   │       ├── ai.ts          # AI parser (text & vision/receipt)
│   │       ├── telegram.ts    # Telegram bot handler
│   │       └── auth.ts        # Better Auth config
│   ├── pages/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── parse-transaction.ts   # AI text endpoint
│   │   │   │   └── parse-receipt.ts       # AI vision/receipt endpoint
│   │   │   └── telegram/
│   │   │       ├── webhook.ts             # Telegram webhook handler
│   │   │       └── link.ts               # Telegram account linking
│   │   └── ...
│   └── scripts/
│       └── telegram-bot.ts    # Polling script (local dev only)
├── .env.example               # Template environment variables
└── package.json
```

---

## 🚀 Getting Started

### Prasyarat

- **Node.js** 18+
- **MySQL** 8.x (lokal atau cloud)
- Akun **OpenRouter** (gratis) untuk fitur AI
- Akun **Telegram** + bot dari BotFather (opsional)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/uangku.git
cd uangku
npm install
```

### 2. Konfigurasi Environment

Salin file contoh dan isi nilainya:

```bash
cp .env.example .env
```

Isi file `.env` (lihat tabel lengkap di bawah).

### 3. Setup Database

```bash
# Generate migration
npm run db:generate

# Jalankan migration ke database
npm run db:migrate
```

### 4. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:4321](http://localhost:4321) di browser.

---

## ⚙️ Environment Variables

Buat file `.env` di root proyek dengan variabel berikut:

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | ✅ | Connection string MySQL, misal `mysql://user:pass@localhost:3306/uangku` |
| `BETTER_AUTH_SECRET` | ✅ | Secret acak minimal 32 karakter untuk JWT/session |
| `BETTER_AUTH_URL` | ✅ | URL aplikasi, misal `http://localhost:4321` |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth Client ID (dari Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth Client Secret |
| `SMTP_HOST` | ❌ | Host SMTP untuk email (misal `smtp.gmail.com`) |
| `SMTP_PORT` | ❌ | Port SMTP (misal `587`) |
| `SMTP_USER` | ❌ | Email pengirim |
| `SMTP_PASS` | ❌ | Password atau App Password email |
| `OPENROUTER_API_KEY` | ❌ | API key OpenRouter (fitur AI aktif). Daftar gratis di [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | ❌ | Model teks AI (default: `recursive/flint-v1.0:free`) |
| `TELEGRAM_BOT_TOKEN` | ❌ | Token bot dari [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | ❌ | Username bot tanpa `@`, misal `uangku_bot` |

---

## 🤖 AI — Cara Penggunaan

### Input Teks Natural Language

Di modal tambah transaksi, ketik di kotak **"Catat Cepat dengan AI"**:

```
Beli kopi 25rb
Terima gaji 5 juta dari PT Maju
Bayar listrik 150.000
Transfer ke tabungan 500k
```

AI akan mengekstrak: **jenis** (pemasukan/pengeluaran), **jumlah**, **kategori**, dan **keterangan** secara otomatis.

### Upload Struk / Bukti Transfer

Klik tombol 📷 di modal transaksi, upload foto struk belanja atau bukti transfer bank. AI vision (`nvidia/nemotron-3.5-super-vl:free`) akan membaca dan mengisi form secara otomatis.

> **Catatan:** Fitur AI tetap berjalan tanpa API key menggunakan heuristic parser sederhana berbasis Bahasa Indonesia.

---

## 🤖 Telegram Bot

### Setup Bot

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → ikuti instruksi
2. Salin token bot ke `.env`:
   ```
   TELEGRAM_BOT_TOKEN=1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ
   TELEGRAM_BOT_USERNAME=nama_bot_kamu
   ```
3. Buka aplikasi → Profile → bagian **Telegram**
4. Klik **"Aktifkan Webhook"** (production) atau jalankan `npm run telegram` (lokal)
5. Salin **kode tautan** dari profil, kirim ke bot: `/link KODE_KAMU`

### Perintah Bot

| Perintah | Fungsi |
|----------|--------|
| `/start` | Sambutan & panduan awal |
| `/bantuan` | Tampilkan semua perintah |
| `/link <kode>` | Hubungkan akun Telegram ke Uangku |
| `/unlink` | Putuskan tautan akun |
| `/saldo` | Cek ringkasan saldo & transaksi bulan ini |
| `/laporan` | Laporan keuangan 30 hari terakhir |
| `/budget` | Pantau realisasi anggaran per kategori |
| *(teks bebas)* | Catat transaksi dengan kalimat biasa menggunakan AI |
| *(foto struk)* | Upload struk/bukti transfer — langsung tercatat |

### Mode Jalankan Bot

| Mode | Kapan Digunakan | Cara |
|------|-----------------|------|
| **Webhook** | Production (Vercel) | Aktifkan dari Profile UI atau `GET /api/telegram/webhook?setWebhook=true` |
| **Polling** | Lokal / development | `npm run telegram` |

---

## 📦 Perintah NPM

| Perintah | Aksi |
|----------|------|
| `npm install` | Install semua dependensi |
| `npm run dev` | Dev server di `localhost:4321` |
| `npm run build` | Build production ke `./dist/` |
| `npm run preview` | Preview build lokal |
| `npm run db:generate` | Generate file migrasi Drizzle |
| `npm run db:migrate` | Jalankan migrasi ke database |
| `npm run telegram` | Jalankan Telegram bot mode polling (lokal) |

---

## 🚢 Deploy ke Vercel

1. Push kode ke GitHub / GitLab
2. Import proyek di [vercel.com](https://vercel.com/new)
3. Tambahkan semua **Environment Variables** dari tabel di atas
4. Deploy!
5. Setelah deploy, buka **Profile → Telegram** dan klik **"Aktifkan Webhook"** agar bot aktif

> ⚠️ Di Vercel (serverless), Telegram bot berjalan via **webhook** secara otomatis. `npm run telegram` hanya untuk pengembangan lokal.

---

## 🗂️ Database Schema (Ringkasan)

```
users              → id, name, email, telegram_chat_id, telegram_username, telegram_link_code, ...
transactions       → id, user_id, type, amount, category, description, date, bukti_pembayaran, ...
budgets            → id, user_id, category, amount, month, year
savings_goals      → id, user_id, name, target_amount, current_amount, deadline
```

---

## 🤝 Kontribusi

Kontribusi selalu disambut! Silakan:

1. Fork repositori ini
2. Buat branch fitur: `git checkout -b feature/nama-fitur`
3. Commit perubahan: `git commit -m 'feat: tambah fitur X'`
4. Push: `git push origin feature/nama-fitur`
5. Buka **Pull Request**

---

## 📄 Lisensi

Didistribusikan di bawah **MIT License**. Lihat [`LICENSE`](LICENSE) untuk detail.

---

<div align="center">

Dibuat dengan ❤️ oleh **Rokib Munawir**

</div>
