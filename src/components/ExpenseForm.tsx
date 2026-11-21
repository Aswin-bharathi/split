import { Calculator, Check, CircleDollarSign, NotebookText, Tag, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { defaultSplitForCategory } from '../lib/categories';
import type { Category, Expense, Member, ParticipantInput, SplitMethod } from '../lib/types';
import { currency, memberName } from '../lib/utils';

const methods: SplitMethod[] = ['equal', 'quantity', 'percentage', 'exact', 'weighted'];
const keypad = ['+', '7', '8', '9', '-', '4', '5', '6', '×', '1', '2', '3', '÷', '0', '.', '='];

type Draft = {
  title: string;
  amount: number;
  date: string;
  category: Category;
  paidBy: string;
  splitMethod: SplitMethod;
  notes?: string;
  participants: ParticipantInput[];
};

type ExpenseFormProps = {
  members: Member[];
  editingExpense?: Expense | null;
  expenseCategories?: string[];
  onCancelEdit?: () => void;
  onSubmit: (draft: Draft) => void | Promise<void>;
  saving?: boolean;
};

const blankValues = (members: Member[]) =>
  members.reduce<Record<string, string>>((acc, member, index) => {
    acc[member.id] = index === 0 ? '1' : '1';
    return acc;
  }, {});

const valuesForMethod = (method: SplitMethod, members: Member[], amount: number) =>
  members.reduce<Record<string, string>>((acc, member, index) => {
    if (method === 'percentage') {
      const base = Math.floor(100 / members.length);
      const used = base * (members.length - 1);
      acc[member.id] = String(index === members.length - 1 ? 100 - used : base);
      return acc;
    }
    if (method === 'exact') {
      const base = Math.floor((amount / members.length) * 100) / 100;
      const used = base * (members.length - 1);
      acc[member.id] = String(index === members.length - 1 ? Math.round((amount - used) * 100) / 100 : base);
      return acc;
    }
    if (method === 'weighted') {
      acc[member.id] = String(members.length - index);
      return acc;
    }
    acc[member.id] = index === 0 ? '4' : '2';
    return acc;
  }, {});

export function ExpenseForm({ members, editingExpense, expenseCategories = [], onCancelEdit, onSubmit, saving }: ExpenseFormProps) {
  const categories = expenseCategories as Category[];
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<Category>(() => categories[0] ?? '');
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? '');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [notes, setNotes] = useState('');
  const [memberValues, setMemberValues] = useState<Record<string, string>>(() => blankValues(members));
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<string | null>(null);
  const amount = Number(amountText) || 0;

  useEffect(() => {
    if (!editingExpense) return;
    setTitle(editingExpense.title);
    setAmountText(String(editingExpense.amount));
    setDate(editingExpense.date);
    setCategory(editingExpense.category);
    setPaidBy(editingExpense.paidBy);
    setSplitMethod(editingExpense.splitMethod);
    setNotes(editingExpense.notes ?? '');
    setMemberValues(
      editingExpense.participants.reduce<Record<string, string>>((acc, participant) => {
        acc[participant.memberId] = String(
          participant.input?.quantity ??
            participant.input?.percentage ??
            participant.input?.exactAmount ??
            participant.input?.weight ??
            participant.share
        );
        return acc;
      }, {})
    );
  }, [editingExpense]);

  useEffect(() => {
    if (!paidBy && members[0]) setPaidBy(members[0].id);
  }, [members, paidBy]);

  const splitTotal = useMemo(() => {
    if (splitMethod === 'equal') return amount;
    return members.reduce((sum, member) => sum + (Number(memberValues[member.id]) || 0), 0);
  }, [amount, memberValues, members, splitMethod]);

  const splitHint = useMemo(() => {
    if (splitMethod === 'quantity') return `Total quantity: ${splitTotal || 0}`;
    if (splitMethod === 'percentage') return `Total percentage: ${splitTotal || 0}%`;
    if (splitMethod === 'exact') return `Exact total: ${currency.format(splitTotal || 0)}`;
    if (splitMethod === 'weighted') return `Total weight: ${splitTotal || 0}`;
    return `${currency.format(amount / Math.max(members.length, 1))} each`;
  }, [amount, members.length, splitMethod, splitTotal]);

  const calculate = (left: number, right: number, operator: string) => {
    if (operator === '+') return left + right;
    if (operator === '-') return left - right;
    if (operator === '×') return left * right;
    if (operator === '÷') return right === 0 ? left : left / right;
    return right;
  };

  const pressKey = (key: string) => {
    if (['+', '-', '×', '÷'].includes(key)) {
      setStoredValue(amount);
      setPendingOperator(key);
      setAmountText('0');
      return;
    }
    if (key === '=') {
      if (storedValue === null || !pendingOperator) return;
      const result = Math.max(0, calculate(storedValue, amount, pendingOperator));
      setAmountText(String(Math.round(result * 100) / 100));
      setStoredValue(null);
      setPendingOperator(null);
      return;
    }
    setAmountText((current) => {
      if (key === '.' && current.includes('.')) return current;
      const next = current === '0' ? key : `${current}${key}`;
      return next.length > 9 ? current : next;
    });
  };

  const changeCategory = (next: Category) => {
    setCategory(next);
    const method = defaultSplitForCategory(next);
    setSplitMethod(method);
    setMemberValues(valuesForMethod(method, members, amount));
  };

  const changeMethod = (method: SplitMethod) => {
    setSplitMethod(method);
    setMemberValues(valuesForMethod(method, members, amount));
  };

  const clearAmount = () => {
    setAmountText('0');
    setStoredValue(null);
    setPendingOperator(null);
  };

  const cancel = () => {
    setTitle('');
    setAmountText('0');
    setNotes('');
    onCancelEdit?.();
  };

  const submit = async () => {
    const sourceValues =
      (splitMethod === 'percentage' && splitTotal !== 100) || (splitMethod === 'exact' && Math.round(splitTotal * 100) / 100 !== Math.round(amount * 100) / 100)
        ? valuesForMethod(splitMethod, members, amount)
        : memberValues;
    const participants = members.map((member) => {
      const value = Number(sourceValues[member.id]) || 0;
      if (splitMethod === 'quantity') return { memberId: member.id, quantity: value };
      if (splitMethod === 'percentage') return { memberId: member.id, percentage: value };
      if (splitMethod === 'exact') return { memberId: member.id, exactAmount: value };
      if (splitMethod === 'weighted') return { memberId: member.id, weight: value };
      return { memberId: member.id };
    });
    await onSubmit({ title: title || category, amount, date, category, paidBy, splitMethod, notes, participants });
    if (!editingExpense) {
      setTitle('');
      setAmountText('0');
      setNotes('');
    }
  };

  return (
    <section id="expense-entry" className="min-h-screen overflow-hidden bg-[#3f3f3e] text-[#fff9bf] sm:rounded-[24px] sm:border sm:border-[#b8b493]/70 sm:shadow-lg">
      <div className="flex items-center justify-between px-4 py-4 text-base font-semibold sm:text-lg">
        <button className="flex items-center gap-2 text-[#ffd400]" onClick={cancel}>
          <X size={24} /> CANCEL
        </button>
        <button className="flex items-center gap-2 text-[#ffd400]" onClick={submit} disabled={amount <= 0 || saving || !category}>
          <Check size={24} /> {saving ? 'SAVING...' : 'SAVE'}
        </button>
      </div>

      <div className="px-3 pb-2 text-center text-sm font-semibold tracking-wide text-[#fff9bf] sm:px-5">
        ADD EXPENSE
      </div>

      <div className="grid gap-3 px-3 pb-4 sm:px-4">
        <input
          className="rounded-2xl border-2 border-[#b8b493] bg-transparent px-4 py-3 text-lg font-semibold outline-none placeholder:text-[#d8d4b4]/60 sm:text-xl"
          placeholder="Expense title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <label className="expense-select">
            <UserRound size={21} />
            <select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label className="expense-select">
            <Tag size={21} />
            {categories.length > 0 ? (
              <select value={category} onChange={(event) => changeCategory(event.target.value as Category)}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : (
              <span className="text-sm text-[#ff8667]">Add a category first</span>
            )}
          </label>
        </div>
        <textarea
          className="min-h-20 rounded-2xl border-2 border-[#b8b493] bg-[#4b4b40] px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-300 sm:min-h-24 sm:text-lg"
          placeholder="Add notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <div className="rounded-2xl border-2 border-[#b8b493] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-[#d8d4b4]"><CircleDollarSign size={18} /> Amount</span>
            <div className="flex items-center gap-3">
              <span className="max-w-[12rem] truncate text-[clamp(2.5rem,13vw,3rem)] font-semibold">{amountText}</span>
              <button className="rounded-xl border-2 border-[#fff9bf] p-1" onClick={clearAmount}><X size={18} /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {keypad.map((key) => (
            <button
              key={key}
              className={`grid h-12 place-items-center rounded-lg border-2 border-[#b8b493] text-xl font-semibold sm:h-14 sm:text-2xl ${
                ['+', '-', '×', '÷', '='].includes(key) ? 'bg-[#b8b493] text-[#3f3f3e]' : 'bg-[#3f3f3e] text-[#fff9bf]'
              }`}
              onClick={() => pressKey(key)}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border-2 border-[#b8b493] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold"><Calculator size={18} /> Split</span>
            <select className="rounded-xl bg-[#4b4b40] px-3 py-2 outline-none" value={splitMethod} onChange={(event) => changeMethod(event.target.value as SplitMethod)}>
              {methods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>
          {splitMethod !== 'equal' && (
            <div className="grid gap-2">
              {members.map((member) => (
                <label key={member.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2 text-sm text-[#d8d4b4] sm:grid-cols-[1fr_96px]">
                  <span className="truncate">{memberName(members, member.id)}</span>
                  <input
                    className="rounded-xl border border-[#b8b493] bg-transparent px-3 py-2 text-right text-[#fff9bf] outline-none"
                    inputMode="decimal"
                    value={memberValues[member.id] ?? ''}
                    onChange={(event) => setMemberValues((current) => ({ ...current, [member.id]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}
          <p className="flex items-center gap-2 text-sm text-[#d8d4b4]"><NotebookText size={16} /> {splitHint}</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#b8b493] text-center text-base font-semibold sm:text-xl">
          <input className="bg-transparent py-2 text-center outline-none" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <span className="py-2">{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </div>
    </section>
  );
}
