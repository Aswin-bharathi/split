import type { Balance, Expense, ParticipantInput, ParticipantShare, Settlement, SettlementRecord } from './types';

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const distributeRemainder = (shares: ParticipantShare[], amount: number) => {
  const rounded = shares.map((share) => ({ ...share, share: roundMoney(share.share) }));
  const delta = roundMoney(amount - rounded.reduce((sum, share) => sum + share.share, 0));
  if (rounded.length && delta !== 0) rounded[0].share = roundMoney(rounded[0].share + delta);
  return rounded;
};

export function calculateEqualSplit(amount: number, memberIds: string[]): ParticipantShare[] {
  return distributeRemainder(
    memberIds.map((memberId) => ({ memberId, share: amount / memberIds.length })),
    amount
  );
}

export function calculateQuantitySplit(amount: number, inputs: ParticipantInput[]): ParticipantShare[] {
  const totalQuantity = inputs.reduce((sum, input) => sum + (input.quantity ?? 0), 0);
  if (totalQuantity <= 0) throw new Error('Total quantity must be greater than zero.');
  return distributeRemainder(
    inputs.map((input) => ({
      memberId: input.memberId,
      share: amount * ((input.quantity ?? 0) / totalQuantity),
      input
    })),
    amount
  );
}

export function calculatePercentageSplit(amount: number, inputs: ParticipantInput[]): ParticipantShare[] {
  const totalPercentage = roundMoney(inputs.reduce((sum, input) => sum + (input.percentage ?? 0), 0));
  if (totalPercentage !== 100) throw new Error('Percentages must total 100.');
  return distributeRemainder(
    inputs.map((input) => ({
      memberId: input.memberId,
      share: amount * ((input.percentage ?? 0) / 100),
      input
    })),
    amount
  );
}

export function calculateExactSplit(amount: number, inputs: ParticipantInput[]): ParticipantShare[] {
  const totalExact = roundMoney(inputs.reduce((sum, input) => sum + (input.exactAmount ?? 0), 0));
  if (totalExact !== roundMoney(amount)) throw new Error('Exact amounts must match the expense total.');
  return inputs.map((input) => ({
    memberId: input.memberId,
    share: roundMoney(input.exactAmount ?? 0),
    input
  }));
}

export function calculateWeightedSplit(amount: number, inputs: ParticipantInput[]): ParticipantShare[] {
  const totalWeight = inputs.reduce((sum, input) => sum + (input.weight ?? 0), 0);
  if (totalWeight <= 0) throw new Error('Total weight must be greater than zero.');
  return distributeRemainder(
    inputs.map((input) => ({
      memberId: input.memberId,
      share: amount * ((input.weight ?? 0) / totalWeight),
      input
    })),
    amount
  );
}

export function calculateBalances(expenses: Expense[], memberIds: string[]): Balance[] {
  return memberIds.map((memberId) => {
    const paid = roundMoney(expenses.filter((expense) => expense.paidBy === memberId).reduce((sum, expense) => sum + expense.amount, 0));
    const consumed = roundMoney(
      expenses.reduce((sum, expense) => sum + (expense.participants.find((participant) => participant.memberId === memberId)?.share ?? 0), 0)
    );
    return { memberId, paid, consumed, balance: roundMoney(paid - consumed) };
  });
}

export function simplifyDebts(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((balance) => balance.balance > 0.009)
    .map((balance) => ({ memberId: balance.memberId, amount: roundMoney(balance.balance) }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((balance) => balance.balance < -0.009)
    .map((balance) => ({ memberId: balance.memberId, amount: roundMoney(Math.abs(balance.balance)) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));
    if (amount > 0) settlements.push({ from: debtor.memberId, to: creditor.memberId, amount, status: 'pending' });
    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);
    if (debtor.amount <= 0.009) debtorIndex += 1;
    if (creditor.amount <= 0.009) creditorIndex += 1;
  }

  return settlements;
}

export const calculateSettlement = (expenses: Expense[], memberIds: string[]) => simplifyDebts(calculateBalances(expenses, memberIds));

export function calculateRelationshipSettlements(expenses: Expense[]): Settlement[] {
  const ledger = new Map<string, number>();
  const addDebt = (from: string, to: string, amount: number) => {
    if (from === to || amount <= 0) return;
    const key = `${from}->${to}`;
    ledger.set(key, roundMoney((ledger.get(key) ?? 0) + amount));
  };

  expenses.forEach((expense) => {
    expense.participants.forEach((participant) => {
      addDebt(participant.memberId, expense.paidBy, participant.share);
    });
  });

  return netSettlementLedger(ledger);
}

export function applySettlementRecordsToRelationships(
  settlements: Settlement[],
  records: Pick<SettlementRecord, 'from' | 'to' | 'amount'>[]
): Settlement[] {
  const ledger = new Map<string, number>();
  settlements.forEach((settlement) => {
    ledger.set(`${settlement.from}->${settlement.to}`, settlement.amount);
  });
  records.forEach((record) => {
    applyPaymentToRelationshipLedger(ledger, record.from, record.to, record.amount);
  });
  return netSettlementLedger(ledger);
}

function applyPaymentToRelationshipLedger(ledger: Map<string, number>, from: string, to: string, amount: number) {
  let remaining = amount;
  const exactKey = `${from}->${to}`;
  const exactAmount = ledger.get(exactKey) ?? 0;
  if (exactAmount > 0) {
    const paid = Math.min(exactAmount, remaining);
    ledger.set(exactKey, roundMoney(exactAmount - paid));
    remaining = roundMoney(remaining - paid);
  }
  if (remaining <= 0.009) return;

  const afterOutgoing = reduceLedgerEdges(
    ledger,
    (debtFrom) => debtFrom === from,
    remaining
  );
  const paidFromOutgoing = roundMoney(remaining - afterOutgoing);
  if (paidFromOutgoing <= 0.009) return;

  reduceLedgerEdges(
    ledger,
    (_debtFrom, debtTo) => debtTo === to,
    paidFromOutgoing
  );
}

function reduceLedgerEdges(
  ledger: Map<string, number>,
  matches: (from: string, to: string) => boolean,
  amount: number
) {
  let remaining = amount;
  [...ledger.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, current]) => {
      if (remaining <= 0.009 || current <= 0) return;
      const [from, to] = key.split('->');
      if (!matches(from, to)) return;
      const paid = Math.min(current, remaining);
      ledger.set(key, roundMoney(current - paid));
      remaining = roundMoney(remaining - paid);
    });
  return remaining;
}

function netSettlementLedger(ledger: Map<string, number>): Settlement[] {
  const pairs = new Set<string>();
  ledger.forEach((_amount, key) => {
    const [from, to] = key.split('->');
    pairs.add([from, to].sort().join('::'));
  });

  const settlements: Settlement[] = [];
  pairs.forEach((pair) => {
    const [a, b] = pair.split('::');
    const aToB = ledger.get(`${a}->${b}`) ?? 0;
    const bToA = ledger.get(`${b}->${a}`) ?? 0;
    const net = roundMoney(aToB - bToA);
    if (net > 0.009) settlements.push({ from: a, to: b, amount: net, status: 'pending' });
    if (net < -0.009) settlements.push({ from: b, to: a, amount: Math.abs(net), status: 'pending' });
  });

  return settlements.sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    return a.to.localeCompare(b.to);
  });
}

export function applySettlementRecordsToBalances(
  balances: Balance[],
  records: Pick<SettlementRecord, 'from' | 'to' | 'amount'>[]
): Balance[] {
  if (!records.length) return balances;
  return balances.map((balance) => {
    const paidOut = records
      .filter((record) => record.from === balance.memberId)
      .reduce((sum, record) => sum + record.amount, 0);
    const received = records
      .filter((record) => record.to === balance.memberId)
      .reduce((sum, record) => sum + record.amount, 0);
    const adjustedBalance = roundMoney(balance.balance + paidOut - received);
    return {
      ...balance,
      balance: adjustedBalance
    };
  });
}

export function applyPartialSettlements(
  settlements: Settlement[],
  partials: { from: string; to: string; amount: number }[]
): Settlement[] {
  if (!partials.length) return settlements;
  return settlements
    .map((settlement) => {
      const paid = roundMoney(
        partials.filter((p) => p.from === settlement.from && p.to === settlement.to).reduce((sum, p) => sum + p.amount, 0)
      );
      return { ...settlement, amount: roundMoney(Math.max(0, settlement.amount - paid)) };
    })
    .filter((settlement) => settlement.amount > 0.009);
}
