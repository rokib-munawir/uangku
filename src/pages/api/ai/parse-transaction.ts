import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { parseTransaction } from "../../../lib/server/ai";

export const POST: APIRoute = async ({ request }) => {
  // Pastikan pengguna sudah login.
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

    if (
      typeof body.message !== "string" ||
      body.message.trim().length === 0 ||
      body.message.length > 1000
    ) {
      return new Response(JSON.stringify({ error: "Input kalimat transaksi tidak valid." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const transaction = await parseTransaction(body.message.trim());

    return new Response(JSON.stringify({ success: true, transaction }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Gagal memproses transaksi dengan AI." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
