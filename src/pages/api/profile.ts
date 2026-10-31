import type { APIRoute } from 'astro';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getEmojiFromKey, getKeyFromEmoji } from '../../utils/avatarUtils';
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
    
    // Attempt to select the user
    const existingUsers = await db.select().from(users).where(eq(users.id, userId));
    
    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      return new Response(JSON.stringify({
        ...user,
        avatar: getEmojiFromKey(user.avatar || 'default')
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fallback profile if none exists
    const defaultProfile = {
      id: userId,
      name: session.user.name || 'Pengguna Uangku',
      email: session.user.email,
      avatar: 'avatar_user',
      monthlyIncomeGoal: 10000000,
      monthlyExpenseLimit: 5000000,
      expenseLimitPeriod: 'bulanan'
    };

    await db.insert(users).values(defaultProfile);
    
    return new Response(JSON.stringify({
      ...defaultProfile,
      avatar: getEmojiFromKey('avatar_user')
    }), {
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
    const { name, email, avatar, monthlyIncomeGoal, monthlyExpenseLimit, expenseLimitPeriod } = body;

    // Convert emoji string to safe database key (e.g. '👨‍💻' -> 'avatar_dev_m')
    const dbAvatar = getKeyFromEmoji(avatar);

    // Normalize period
    const validPeriod = ['mingguan', 'bulanan', 'tahunan'].includes(expenseLimitPeriod) ? expenseLimitPeriod : 'bulanan';

    // Check if the user exists
    const existingUsers = await db.select().from(users).where(eq(users.id, userId));

    if (existingUsers.length === 0) {
      // Insert new
      await db.insert(users).values({
        id: userId,
        name,
        email,
        avatar: dbAvatar,
        monthlyIncomeGoal: parseFloat(monthlyIncomeGoal) || 0,
        monthlyExpenseLimit: parseFloat(monthlyExpenseLimit) || 0,
        expenseLimitPeriod: validPeriod
      });
    } else {
      // Update existing
      await db.update(users).set({
        name,
        email,
        avatar: dbAvatar,
        monthlyIncomeGoal: parseFloat(monthlyIncomeGoal) || 0,
        monthlyExpenseLimit: parseFloat(monthlyExpenseLimit) || 0,
        expenseLimitPeriod: validPeriod
      }).where(eq(users.id, userId));
    }

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

