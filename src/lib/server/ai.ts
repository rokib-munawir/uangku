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
 * Clean description so nominal amount or currency words are NOT included in notes/description.
 * E.g.: "Beli nasi goreng 25rb" -> "Beli nasi goreng"
 */
export function cleanTransactionDescription(
  desc: string,
  category: string = "Lainnya",
  type: "income" | "expense" = "expense"
): string {
  if (!desc) {
    return type === "income" ? (category === "Gaji" ? "Gaji" : `Pemasukan ${category}`) : category;
  }

  let cleaned = desc;

  // 1. Remove common currency prefixes/amounts
  cleaned = cleaned.replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k|perak)\b/gi, " ");
  cleaned = cleaned.replace(/(?:rp\.?\s*)\d{1,3}(?:\.\d{3})+/gi, " ");
  cleaned = cleaned.replace(/(?:rp\.?\s*)\d{3,10}/gi, " ");
  cleaned = cleaned.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, " ");
  cleaned = cleaned.replace(/\b\d{3,10}\b/g, " ");
  cleaned = cleaned.replace(/\brp\.?\b/gi, " ");

  // 2. Remove filler words like "sebesar", "seharga", "senilai", "sebanyak", "total"
  cleaned = cleaned.replace(/\b(?:sebesar|seharga|senilai|sebanyak|total)\b/gi, " ");

  // 3. Clean up multiple spaces, hyphens, colons, or punctuation at edges
  cleaned = cleaned.replace(/[-:,;]+$/g, "").replace(/^[-:,;]+/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  // 4. If cleaning leaves it empty or too short (e.g. user only typed "25rb"), fallback gracefully
  if (!cleaned || cleaned.length < 2) {
    return type === "income" ? (category === "Gaji" ? "Gaji Bulanan" : `Pemasukan ${category}`) : category;
  }

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

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
    if (/makan|minum|kopi|susu|sarapan|siang|malam|snack|jajan|bakso|ayam|mie|roti|resto|cafe|kafe|nasi|warteg|kfc|mcd|sate/i.test(lower)) {
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

  // 5. Clean description (Strip nominal words so description does NOT contain amount)
  const description = cleanTransactionDescription(text, category, type);

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
  const configModel = (typeof import.meta.env !== 'undefined' && import.meta.env.OPENROUTER_MODEL) || process.env.OPENROUTER_MODEL;

  // Prioritize 100% free models on OpenRouter
  const freeTextModels = [
    configModel && !configModel.includes("embed") ? configModel : "recursive/flint-v1.0:free",
    "openrouter/free",
    "recursive/flint-v1.0:free",
    "liquid/lfm-3-1.7b:free",
    "nvidia/nemotron-3.5-lightning:free"
  ];

  // Remove duplicates
  const candidateModels = Array.from(new Set(freeTextModels));

  if (envApiKey) {
    for (const model of candidateModels) {
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
- description: Nama barang, merchant, atau keperluan transaksi SAJA TANPA menyertakan nominal angka/harga (Contoh: "Beli bakso 25rb" -> description: "Beli bakso", BUKAN "Beli bakso 25rb").
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
          const choice = result.choices?.[0];
          const rawContent = choice?.message?.content || choice?.message?.reasoning || "";

          if (typeof rawContent === "string" && rawContent.trim()) {
            const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const validated = TransactionSchema.parse(parsed);
              validated.description = cleanTransactionDescription(validated.description, validated.category, validated.type);
              return validated;
            }
          }
        }
      } catch (apiError) {
        console.warn(`Free model ${model} parse failed, trying next free model:`, apiError);
      }
    }
  }

  // Fallback to robust Indonesian heuristic parser
  return fallbackParseIndonesian(message);
}

/**
 * Intelligent receipt / proof of payment vision parser.
 * Analyzes an image (Base64 Data URI or Image URL) to extract transaction details WITHOUT requiring caption.
 * Focuses strictly on 100% FREE Vision LLMs.
 */
export async function parseReceiptImage(
  imageUrlOrBase64: string,
  caption?: string
): Promise<ParsedTransaction> {
  const envApiKey = (typeof import.meta.env !== 'undefined' && import.meta.env.OPENROUTER_API_KEY) || process.env.OPENROUTER_API_KEY;

  // 100% FREE vision models on OpenRouter
  const freeVisionModels = [
    "openrouter/free",
    "nvidia/nemotron-3.5-super-vl:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free"
  ];

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
- amount: WAJIB angka bulat murni tanpa titik/koma ribuan atau kata 'Rp' (contoh: 25000, 150000). Cari TOTAL AKHIR / TOTAL BAYAR / JUMLAH TRANSFER / GRAND TOTAL.
- type: Jika bukti transfer keluar / belanja / struk kasir = "expense". Jika bukti transfer masuk / setoran = "income".
- category: Pilih salah satu yang paling cocok: Makanan, Transportasi, Belanja, Pendidikan, Hiburan, Tabungan, Gaji, Lainnya.
- description: Nama merchant/toko atau keterangan transaksi TANPA mencantumkan angka nominalnya (misal: "Indomaret", "Makan di KFC", "Transfer ke PT ABC", "Bensin Pertamina").
- paymentMethod:
  - "bank_transfer" jika ada nama bank (BCA, BRI, Mandiri, BNI, Jago, dll).
  - "e_wallet" jika QRIS, GoPay, OVO, Dana, ShopeePay.
  - "cash" jika tertulis Tunai/Cash.
  - "other" jika lainnya.
- date: Tanggal yang tertera pada bukti pembayaran dalam format YYYY-MM-DD. Jika tidak terlihat, isi null.
${caption && caption.trim() ? `Keterangan tambahan: "${caption.trim()}"` : "Analisis langsung dari gambar nota/struk."}

PENTING: Balas HANYA teks JSON valid tanpa format markdown atau penjelasan lain.
  `.trim();

  // If API key available, try 100% free vision models
  if (envApiKey) {
    for (const model of freeVisionModels) {
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
            max_tokens: 1000,
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
          const choice = result.choices?.[0];
          const rawText = choice?.message?.content || choice?.message?.reasoning || "";

          if (typeof rawText === "string" && rawText.trim()) {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const validated = TransactionSchema.parse(parsed);
              if (validated.amount > 0) {
                // Ensure description is cleaned from nominal leaks
                validated.description = cleanTransactionDescription(validated.description, validated.category, validated.type);
                return validated;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Free vision AI model ${model} failed, trying next:`, error);
      }
    }
  }

  // Fallback to caption text parsing ONLY if caption was explicitly provided
  if (caption && caption.trim()) {
    return parseTransaction(caption);
  }

  if (!envApiKey) {
    throw new Error("Kunci API OpenRouter belum dikonfigurasi.");
  }

  throw new Error("Gagal membaca bukti pembayaran dari gambar. Pastikan gambar jelas, fokus, dan memuat total nominal pembayaran.");
}
