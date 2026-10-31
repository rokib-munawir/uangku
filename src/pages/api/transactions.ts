import type { APIRoute } from 'astro';
import { db } from '../../db';
import { transactions } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '../../lib/auth';

export const GET: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers
    });
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;

    const list = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.tanggal), desc(transactions.id));
    
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers
    });
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;
    const body = await context.request.json();
    const { nominal, kategori, tanggal, catatan, tipe, buktiPembayaran } = body;

    const newId = Date.now().toString();
    const newTx = {
      id: newId,
      userId: userId,
      nominal: parseFloat(nominal),
      kategori,
      tanggal,
      catatan,
      tipe,
      buktiPembayaran: buktiPembayaran || null
    };

    await db.insert(transactions).values(newTx);

    return new Response(JSON.stringify({ success: true, transaction: newTx }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers
    });
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
    }

    // Safety: only delete if the transaction belongs to this user!
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

