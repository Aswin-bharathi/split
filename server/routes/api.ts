import { Router } from 'express';
import { randomUUID } from 'crypto';
import { Member } from '../models/Member.js';
import { Group } from '../models/Group.js';
import { Expense } from '../models/Expense.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Notification } from '../models/Notification.js';
import { Category } from '../models/Category.js';
import { SettlementRecord } from '../models/SettlementRecord.js';
import { requireAuth, requireAdmin, getSessionUserId } from '../middleware/auth.js';
import { hashPassword } from '../lib/auth.js';
import { nameToUsername } from '../lib/username.js';

export const apiRouter = Router();

const now = () => new Date().toISOString();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

apiRouter.get('/bootstrap', requireAuth, async (req, res) => {
  try {
    const currentUserId = getSessionUserId(req)!;
    const [members, groups, expenses, activityLogs, notifications, categories, settlementRecords] = await Promise.all([
      Member.find().lean(),
      Group.find().lean(),
      Expense.find().sort({ date: -1 }).lean(),
      ActivityLog.find().sort({ timestamp: -1 }).lean(),
      Notification.find().sort({ createdAt: -1 }).lean(),
      Category.find().lean(),
      SettlementRecord.find().lean()
    ]);

    const settledSettlementKeys = settlementRecords
      .filter((record) => record.status === 'settled' && record.periodKey)
      .map((record) => `${record.periodKey}:${record.from}-${record.to}`);

    const partialSettlements = settlementRecords
      .filter((record) => record.status === 'partial' && record.periodKey)
      .map((record) => ({ from: record.from, to: record.to, amount: record.amount, periodKey: record.periodKey! }));
    const scopedSettlementRecords = settlementRecords
      .filter((record) => record.periodKey)
      .map((record) => ({
        from: record.from,
        to: record.to,
        amount: record.amount,
        groupId: record.groupId,
        periodKey: record.periodKey!,
        status: record.status
      }));

    const expenseCategories = categories.filter((c) => c.type === 'expense').map((c) => c.name);
    const incomeCategories = categories.filter((c) => c.type === 'income').map((c) => c.name);

    const safeMembers = members.map(({ passwordHash: _, ...member }) => member);

    res.json({
      currentUserId,
      activeGroupId: groups[0]?.id ?? '',
      members: safeMembers,
      groups,
      expenses,
      settledSettlementKeys,
      partialSettlements,
      settlementRecords: scopedSettlementRecords,
      activityLogs,
      notifications,
      expenseCategories,
      incomeCategories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

apiRouter.post('/members', requireAdmin, async (req, res) => {
  try {
    const { name, email, groupId, password } = req.body as {
      name: string;
      email?: string;
      groupId: string;
      password: string;
    };
    if (!password || password.length < 4) {
      res.status(400).json({ error: 'Password is required (min 4 characters).' });
      return;
    }
    const username = nameToUsername(name);
    if (!username) {
      res.status(400).json({ error: 'Invalid member name.' });
      return;
    }
    const existing = await Member.findOne({ username }).lean();
    if (existing) {
      res.status(400).json({ error: 'A member with this name already exists.' });
      return;
    }
    const passwordHash = await hashPassword(password);
    const member = {
      id: username,
      username,
      name,
      email: email || `${username}@splitnest.app`,
      avatar: name.charAt(0).toUpperCase(),
      joinedAt: now(),
      role: 'member' as const,
      passwordHash
    };
    await Member.create(member);
    await Group.updateOne({ id: groupId }, { $addToSet: { members: member.id } });
    const { passwordHash: _, ...safeMember } = member;
    const log = {
      id: randomUUID(),
      groupId,
      userId: getSessionUserId(req)!,
      action: `added member ${member.name}`,
      entity: 'member',
      timestamp: now()
    };
    await ActivityLog.create(log);
    res.status(201).json({ member: safeMember, log });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

apiRouter.delete('/members/:memberId', requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { groupId } = req.body as { groupId: string };

    const member = await Member.findOne({ id: memberId }).lean();
    if (!member) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }
    if (member.role === 'admin') {
      res.status(400).json({ error: 'Cannot remove the admin account.' });
      return;
    }

    await Member.deleteOne({ id: memberId });
    await Group.updateMany({}, { $pull: { members: memberId } });

    const log = {
      id: randomUUID(),
      groupId,
      userId: getSessionUserId(req)!,
      action: `removed member ${member.name}`,
      entity: 'member',
      timestamp: now()
    };
    await ActivityLog.create(log);
    res.json({ ok: true, log });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

apiRouter.post('/expenses', requireAuth, async (req, res) => {
  try {
    const draft = req.body;
    const currentUserId = getSessionUserId(req)!;
    const expense = {
      id: randomUUID(),
      groupId: draft.groupId,
      title: draft.title,
      description: draft.description,
      amount: draft.amount,
      date: draft.date,
      category: draft.category,
      paidBy: draft.paidBy,
      createdBy: currentUserId,
      splitMethod: draft.splitMethod,
      notes: draft.notes,
      participants: draft.participants,
      createdAt: now(),
      updatedAt: now()
    };
    await Expense.create(expense);
    const log = {
      id: randomUUID(),
      groupId: draft.groupId,
      userId: currentUserId,
      action: `added ${expense.title} ₹${expense.amount}`,
      entity: 'expense',
      timestamp: now()
    };
    const notification = {
      id: randomUUID(),
      groupId: draft.groupId,
      title: 'New expense added',
      body: `${expense.title} was added for ₹${expense.amount}.`,
      createdAt: now(),
      read: false
    };
    await ActivityLog.create(log);
    await Notification.create(notification);
    res.status(201).json({ expense, log, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

apiRouter.put('/expenses/:expenseId', requireAdmin, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const draft = req.body;
    const currentUserId = getSessionUserId(req)!;
    const updated = await Expense.findOneAndUpdate(
      { id: expenseId },
      {
        title: draft.title,
        description: draft.description,
        amount: draft.amount,
        date: draft.date,
        category: draft.category,
        paidBy: draft.paidBy,
        splitMethod: draft.splitMethod,
        notes: draft.notes,
        participants: draft.participants,
        updatedAt: now()
      },
      { new: true }
    ).lean();
    const log = {
      id: randomUUID(),
      groupId: draft.groupId,
      userId: currentUserId,
      action: `edited ${draft.title} ₹${draft.amount}`,
      entity: 'expense',
      timestamp: now()
    };
    const notification = {
      id: randomUUID(),
      groupId: draft.groupId,
      title: 'Expense updated',
      body: `${draft.title} was updated.`,
      createdAt: now(),
      read: false
    };
    await ActivityLog.create(log);
    await Notification.create(notification);
    res.json({ expense: updated, log, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

apiRouter.post('/expenses/:expenseId/duplicate', requireAdmin, async (req, res) => {
  try {
    const currentUserId = getSessionUserId(req)!;
    const source = await Expense.findOne({ id: req.params.expenseId }).lean();
    if (!source) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const duplicate = {
      ...source,
      _id: undefined,
      id: randomUUID(),
      title: `${source.title} copy`,
      createdBy: currentUserId,
      createdAt: now(),
      updatedAt: now()
    };
    await Expense.create(duplicate);
    res.status(201).json({ expense: duplicate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to duplicate expense' });
  }
});

apiRouter.delete('/expenses/:expenseId', requireAdmin, async (req, res) => {
  try {
    await Expense.deleteOne({ id: req.params.expenseId });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

apiRouter.post('/settlements/settle', requireAuth, async (req, res) => {
  try {
    const { groupId, from, to, amount, periodKey } = req.body;
    if (!periodKey) {
      res.status(400).json({ error: 'Settlement period is required.' });
      return;
    }
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Settlement amount is required.' });
      return;
    }
    const currentUserId = getSessionUserId(req)!;
    const record = {
      id: randomUUID(),
      groupId,
      from,
      to,
      amount,
      status: 'settled' as const,
      periodKey,
      createdAt: now()
    };
    await SettlementRecord.create(record);
    const log = {
      id: randomUUID(),
      groupId,
      userId: currentUserId,
      action: `settled ₹${amount} from ${from} to ${to} for ${periodKey}`,
      entity: 'settlement',
      timestamp: now()
    };
    const notification = {
      id: randomUUID(),
      groupId,
      title: 'Settlement completed',
      body: 'The balance has been marked settled.',
      createdAt: now(),
      read: false
    };
    await ActivityLog.create(log);
    await Notification.create(notification);
    res.json({ settledKey: `${periodKey}:${from}-${to}`, log, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to settle' });
  }
});

apiRouter.post('/settlements/partial', requireAuth, async (req, res) => {
  try {
    const { groupId, from, to, amount, periodKey } = req.body;
    if (!periodKey) {
      res.status(400).json({ error: 'Settlement period is required.' });
      return;
    }
    const currentUserId = getSessionUserId(req)!;
    const record = {
      id: randomUUID(),
      groupId,
      from,
      to,
      amount,
      status: 'partial' as const,
      periodKey,
      createdAt: now()
    };
    await SettlementRecord.create(record);
    const log = {
      id: randomUUID(),
      groupId,
      userId: currentUserId,
      action: `recorded partial settlement ₹${amount} from ${from} to ${to} for ${periodKey}`,
      entity: 'settlement',
      timestamp: now()
    };
    const notification = {
      id: randomUUID(),
      groupId,
      title: 'Partial settlement',
      body: `A partial settlement of ₹${amount} was recorded.`,
      createdAt: now(),
      read: false
    };
    await ActivityLog.create(log);
    await Notification.create(notification);
    res.json({ partial: { groupId, from, to, amount, periodKey, status: 'partial' }, log, notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record partial settlement' });
  }
});

apiRouter.post('/categories', requireAuth, async (req, res) => {
  try {
    const { name, type = 'expense' } = req.body as { name: string; type?: 'expense' | 'income' };
    const existing = await Category.findOne({ name }).lean();
    if (existing) {
      res.json({ category: existing });
      return;
    }
    const category = { id: randomUUID(), name, type };
    await Category.create(category);
    res.status(201).json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

apiRouter.patch('/groups/:groupId/budget', requireAdmin, async (req, res) => {
  try {
    const { budgetLimit } = req.body as { budgetLimit: number };
    const group = await Group.findOneAndUpdate({ id: req.params.groupId }, { budgetLimit }, { new: true }).lean();
    res.json({ group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

apiRouter.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.updateOne({ id: req.params.id }, { read: true });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});
