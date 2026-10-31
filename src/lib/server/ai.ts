import { z } from "zod";

const TransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().min(1),
  paymentMethod: z.enum([
    "cash",
    "bank_transfer",
    "e_wallet",
    "other",
  ]),
  date: z.string().nullable(),
});

export type ParsedTransaction = z.infer<
  typeof TransactionSchema
>;

/**
 * Intelligent Indonesian heuristic fallback parser.
 * Runs if AI is unavailable, rate-limited, or fails.
 */
export function fallbackParseIndonesian(text: string): ParsedTransaction {
  const lower = text.toLowerCase().trim();

  // 1. Detect Amount
  let amount = 0;
  const jtMatch = lower.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
  const rbMatch = lower.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  const formattedNumberMatch = lower.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)/i);
  const plainNumberMatch = lower.match(/(?:rp\.?\s*)?(\d{3,10})/i);

  if (jtMatch) {
    amount = parseFloat(jtMatch[1].replace(',', '.')) * 1_000_000;
  } else if (rbMatch) {
    amount = parseFloat(rbMatch[1].replace(',', '.')) * 1_000;
  } else if (formattedNumberMatch) {
    amount = parseFloat(formattedNumberMatch[1].replace(/\./g, ''));
  } else if (plainNumberMatch) {
    amount = parseFloat(plainNumberMatch[1]);
  }

  if (amount <= 0) {
    throw new Error("Nominal transaksi tidak terdeteksi. Silakan sertakan nominal, misal: 'Beli kopi 25rb'");
  }

  // 2. Detect Type (Income vs Expense)
  const isIncome = /gaji|salary|dapat|terima|pemasukan|income|transfer masuk|bonus|thr|profit|untung|hadiah/i.test(lower);
  const type: "income" | "expense" = isIncome ? "income" : "expense";

  // 3. Detect Payment Method
  let paymentMethod: "cash" | "bank_transfer" | "e_wallet" | "other" = "cash";
  if (/qris|gopay|ovo|dana|shopeepay|linkaja|ewallet|e-wallet/i.test(lower)) {
    paymentMethod = "e_wallet";
  } else if (/bca|mandiri|bni|bri|jago|jenius|seabank|transfer|bank|atm/i.test(lower)) {
    paymentMethod = "bank_transfer";
  } else if (/tunai|cash/i.test(lower)) {
    paymentMethod = "cash";
  }

  // 4. Detect Category
  let category = "Lainnya";
  if (isIncome) {
    category = /gaji|salary/i.test(lower) ? "Gaji" : "Pemasukan";
  } else {
    if (/makan|minum|kopi|susu|sarapan|siang|malam|snack|jajan|bakso|ayam|mie|roti|resto|cafe|kafe|nasi|warteg|kfc|mcd/i.test(lower)) {
      category = "Makanan";
    } else if (/bensin|pertalite|pertamax|solar|gojek|grab|maxim|ojol|parkir|tol|kereta|bus|angkot|taksi|transport/i.test(lower)) {
      category = "Transportasi";
    } else if (/beli|belanja|baju|sepatu|tokopedia|shopee|lazada|tiktok|indomaret|alfamart|supermarket|mall/i.test(lower)) {
      category = "Belanja";
    } else if (/buku|kursus|kuliah|sekolah|spp|les|seminar|edukasi|pelatihan/i.test(lower)) {
      category = "Pendidikan";
    } else if (/game|steam|nonton|bioskop|netflix|spotify|wisata|liburan|karaoke|playstation|topup/i.test(lower)) {
      category = "Hiburan";
    } else if (/tabung|investasi|reksadana|saham|emas|crypto/i.test(lower)) {
      category = "Tabungan";
    }
  }

  // 5. Clean description
  let description = text.trim();
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    type,
    amount,
    category,
    description,
    paymentMethod,
    date: null,
  };
}

export async function parseTransaction(
  message: string,
): Promise<ParsedTransaction> {
  const envApiKey = (typeof import.meta.env !== 'undefined' && import.meta.env.OPENROUTER_API_KEY) || process.env.OPENROUTER_API_KEY;
  let model = (typeof import.meta.env !== 'undefined' && import.meta.env.OPENROUTER_MODEL) || process.env.OPENROUTER_MODEL;

  // Sanitize model: embedding models cannot be used for chat completion
  if (!model || model.includes("embed")) {
    model = "recursive/flint-v1.0:free";
  }

  if (envApiKey) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${envApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:4321",
            "X-Title": "Uangku Finance",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `
Kamu adalah asisten pencatatan keuangan pribadi bernama Uangku AI.
Tugasmu mengekstrak data transaksi dari kalimat bahasa Indonesia.
Kategori standar: Makanan, Transportasi, Belanja, Pendidikan, Hiburan, Tabungan, Gaji, Lainnya.
Format JSON yang WAJIB dihasilkan:
{
  "type": "income" | "expense",
  "amount": number,
  "category": string,
  "description": string,
  "paymentMethod": "cash" | "bank_transfer" | "e_wallet" | "other",
  "date": "YYYY-MM-DD" atau null
}
Aturan:
- Ubah nominal teks seperti "25 ribu", "25rb", "25k" -> 25000. "1.5 juta" -> 1500000.
- type hanya "income" (pemasukan/gaji/terima) atau "expense" (pengeluaran/beli/bayar).
- Jika tanggal tidak disebutkan, isi date: null.
- Jangan mengarang nominal jika tidak ada di teks.
- Balas HANYA teks JSON valid tanpa format markdown atau penjelasan lain.
                `.trim(),
              },
              {
                role: "user",
                content: message,
              },
            ],
            response_format: {
              type: "json_object",
            },
            temperature: 0.1,
          }),
        },
      );

      if (response.ok) {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;

        if (typeof content === "string") {
          // Clean possible markdown wrappers
          const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          return TransactionSchema.parse(parsed);
        }
      }
    } catch (apiError) {
      console.warn("OpenRouter API parse failed, falling back to heuristic parser:", apiError);
    }
  }

  // Fallback to robust Indonesian heuristic parser
  return fallbackParseIndonesian(message);
}

/**
 * Intelligent receipt / proof of payment vision parser.
 * Analyzes an image (Base64 Data URI or Image URL) to extract transaction details.
 */
export async function parseReceiptImage(
  imageUrlOrBase64: string,
  caption?: string
): Promise<ParsedTransaction> {
  const envApiKey = (typeof import.meta.env !== 'undefined' && import.meta.env.OPENROUTER_API_KEY) || process.env.OPENROUTER_API_KEY;
  const model = "nvidia/nemotron-3.5-super-vl:free";

  if (!envApiKey) {
    if (caption && caption.trim()) {
      return parseTransaction(caption);
    }
    throw new Error("Kunci API OpenRouter belum dikonfigurasi.");
  }

  const promptText = `
Kamu adalah asisten keuangan pribadi cerdas bernama Uangku AI.
Tugasmu adalah menganalisis gambar bukti pembayaran, struk belanja kasir, bukti transfer bank, mutasi rekening, atau nota transaksi.
Ekstrak informasi transaksi ke dalam format JSON yang valid:
{
  "type": "expense" | "income",
  "amount": number,
  "category": string,
  "description": string,
  "paymentMethod": "cash" | "bank_transfer" | "e_wallet" | "other",
  "date": "YYYY-MM-DD" atau null
}

Panduan Ekstraksi:
- amount: WAJIB angka bulat/desimal murni tanpa titik ribuan, 'Rp', atau teks (contoh: 25000, 150000). Cari TOTAL AKHIR / TOTAL BAYAR / JUMLAH TRANSFER.
- type: Jika bukti transfer keluar / belanja / struk kasir = "expense". Jika bukti transfer masuk / setoran = "income".
- category: Pilih salah satu yang paling relevan: Makanan, Transportasi, Belanja, Pendidikan, Hiburan, Tabungan, Gaji, Lainnya.
- description: Nama merchant/toko atau keterangan transaksi (misal: "Indomaret", "Makan di KFC", "Transfer ke PT ABC", "Bensin Pertamina").
- paymentMethod:
  - "bank_transfer" jika ada nama bank (BCA, BRI, Mandiri, BNI, dll).
  - "e_wallet" jika QRIS, GoPay, OVO, Dana, ShopeePay.
  - "cash" jika tertulis Tunai/Cash.
  - "other" jika lainnya.
- date: Tanggal yang tertera pada bukti pembayaran dalam format YYYY-MM-DD. Jika tidak terbaca atau tidak ada, isi null.
${caption ? `Keterangan tambahan dari pengguna: "${caption}"` : ""}

PENTING: Balas HANYA teks JSON valid tanpa format markdown atau penjelasan lain.
  `.trim();

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4321",
        "X-Title": "Uangku Finance",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrlOrBase64,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (typeof content === "string") {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return TransactionSchema.parse(parsed);
        }
      }
    }
  } catch (error) {
    console.warn("Vision AI analysis failed:", error);
  }

  // If caption exists, fallback to text parsing
  if (caption && caption.trim()) {
    return parseTransaction(caption);
  }

  throw new Error("Gagal membaca bukti pembayaran dari gambar. Pastikan gambar jelas dan menampilkan total nominal.");
}
