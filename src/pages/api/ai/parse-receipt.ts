import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { parseReceiptImage } from "../../../lib/server/ai";

export const POST: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Silakan login terlebih dahulu." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { image, caption } = body;

    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "File gambar bukti pembayaran wajib disertakan." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const transaction = await parseReceiptImage(image, caption);

    return new Response(JSON.stringify({ success: true, transaction, image }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Gagal memindai bukti pembayaran." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

