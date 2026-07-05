import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Member } from '../models/Member.js';
import { verifyPassword } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { normalizeUsername } from '../lib/username.js';

export const authRouter = Router();

const SECRET = process.env.SESSION_SECRET ?? 'splitnest-dev-secret-change-in-production';

authRouter.post('/login', async (req, res) => {
  try {
    const body = req.body as { username?: string; memberId?: string; password?: string };
    const rawLogin = body.username ?? body.memberId;
    const { password } = body;
    if (!rawLogin || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const normalized = normalizeUsername(rawLogin);
    const member =
      (await Member.findOne({ username: normalized }).lean()) ??
      (await Member.findOne({ id: normalized }).lean());
    if (!member?.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const valid = await verifyPassword(password, member.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const token = jwt.sign({ userId: member.id }, SECRET, { expiresIn: '30d' });

    res.json({
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        joinedAt: member.joinedAt,
        role: member.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

authRouter.post('/logout', (req, res) => {
  // JWT is stateless — client just deletes the token
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const member = await Member.findOne({ id: req.userId }).lean();
    if (!member) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    res.json({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        joinedAt: member.joinedAt,
        role: member.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify session.' });
  }
});
