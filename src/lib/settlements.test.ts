import {
  applySettlementRecordsToBalances,
  applySettlementRecordsToRelationships,
  calculateBalances,
  calculateQuantitySplit,
  calculateRelationshipSettlements,
  simplifyDebts
} from './settlements';
import type { Expense } from './types';

const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

const members = ['hari', 'aswin', 'siva'];
const eggShares = calculateQuantitySplit(48, [
  { memberId: 'hari', quantity: 4 },
  { memberId: 'aswin', quantity: 2 },
  { memberId: 'siva', quantity: 2 }
]);

assertEqual(
  eggShares.map((share) => share.share),
  [24, 12, 12],
  'Quantity split should match the eggs example.'
);

const expenses: Expense[] = [
  {
    id: 'eggs',
    groupId: 'hostel',
    title: 'Eggs',
    amount: 48,
    date: '2026-06-22',
    category: 'Eggs',
    paidBy: 'hari',
    splitMethod: 'quantity',
    participants: eggShares,
    createdAt: '2026-06-22T08:00:00.000Z',
    updatedAt: '2026-06-22T08:00:00.000Z'
  }
];

const balances = calculateBalances(expenses, members);
assertEqual(balances.find((balance) => balance.memberId === 'hari')?.balance, 24, 'Hari should receive the balance paid above his share.');
assertEqual(simplifyDebts(balances), [
  { from: 'aswin', to: 'hari', amount: 12, status: 'pending' },
  { from: 'siva', to: 'hari', amount: 12, status: 'pending' }
], 'Debt simplification should produce two payments to Hari.');

const monthlyBalances = [
  { memberId: 'hari', paid: 0, consumed: 522, balance: -522 },
  { memberId: 'aswin', paid: 258, consumed: 0, balance: 258 },
  { memberId: 'siva', paid: 264, consumed: 0, balance: 264 }
];
const outstandingAfterWeeklySettlement = simplifyDebts(
  applySettlementRecordsToBalances(monthlyBalances, [{ from: 'hari', to: 'aswin', amount: 258 }])
);
assertEqual(outstandingAfterWeeklySettlement, [
  { from: 'hari', to: 'siva', amount: 264, status: 'pending' }
], 'Monthly settlement should exclude a completed weekly payment from the outstanding balance.');

const chainExpenses: Expense[] = [
  {
    id: 'b-paid-for-a',
    groupId: 'hostel',
    title: 'Dinner',
    amount: 100,
    date: '2026-06-23',
    category: 'Food',
    paidBy: 'aswin',
    splitMethod: 'exact',
    participants: [{ memberId: 'hari', share: 100 }],
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z'
  },
  {
    id: 'c-paid-for-b',
    groupId: 'hostel',
    title: 'Milk',
    amount: 100,
    date: '2026-06-24',
    category: 'Milk',
    paidBy: 'siva',
    splitMethod: 'exact',
    participants: [{ memberId: 'aswin', share: 100 }],
    createdAt: '2026-06-24T08:00:00.000Z',
    updatedAt: '2026-06-24T08:00:00.000Z'
  }
];

const relationshipSettlements = calculateRelationshipSettlements(chainExpenses);
assertEqual(relationshipSettlements, [
  { from: 'aswin', to: 'siva', amount: 100, status: 'pending' },
  { from: 'hari', to: 'aswin', amount: 100, status: 'pending' }
], 'Relationship settlement should show direct expense-based obligations.');

assertEqual(simplifyDebts(calculateBalances(chainExpenses, members)), [
  { from: 'hari', to: 'siva', amount: 100, status: 'pending' }
], 'Simplified settlement should collapse the middle person into one optimized transfer.');

assertEqual(
  applySettlementRecordsToRelationships(relationshipSettlements, [{ from: 'hari', to: 'siva', amount: 100 }]),
  [],
  'An optimized chain payment should clear the matching relationship obligations.'
);

console.log('Settlement engine checks passed.');
