import { ChevronLeft, Utensils } from 'lucide-react';
import type { Expense, Member } from '../lib/types';
import { currency, memberName } from '../lib/utils';
import type { PeriodMode } from '../lib/period';

type MemberHistoryProps = {
  memberId: string;
  memberName: string;
  expenses: Expense[];
  members: Member[];
  periodMode: PeriodMode;
  expenseCategories: string[];
  onBack: () => void;
};

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'long'
  });

export function MemberHistory({
  memberId,
  memberName: name,
  expenses,
  members,
  periodMode,
  expenseCategories,
  onBack
}: MemberHistoryProps) {
  const memberExpenses = expenses.filter(
    (expense) =>
      expense.paidBy === memberId ||
      expense.createdBy === memberId ||
      expense.participants.some((p) => p.memberId === memberId)
  );

  const totalPaid = memberExpenses
    .filter((e) => e.paidBy === memberId)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalShare = memberExpenses.reduce(
    (sum, e) => sum + (e.participants.find((p) => p.memberId === memberId)?.share ?? 0),
    0
  );
  const categorySpend = expenseCategories
    .map((category) => ({
      category,
      amount: memberExpenses
        .filter((expense) => expense.category === category && expense.paidBy === memberId)
        .reduce((sum, expense) => sum + expense.amount, 0)
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const grouped = memberExpenses.reduce<Record<string, Expense[]>>((acc, expense) => {
    const label = dayLabel(expense.date);
    acc[label] = [...(acc[label] ?? []), expense];
    return acc;
  }, {});

  return (
    <section className="space-y-5">
      <button
        className="flex items-center gap-2 text-[#fff27c] transition hover:text-[#fff9bf]"
        onClick={onBack}
      >
        <ChevronLeft size={24} />
        <span className="font-semibold">Back to analysis</span>
      </button>

      <div className="rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-4 sm:p-5">
        <h2 className="text-2xl font-bold text-[#fff9bf]">{name}&apos;s history</h2>
        <p className="mt-1 text-sm text-[#b8b493]">
          Showing records for the selected {periodMode} period.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[#b8b493]">Total paid</p>
            <p className="text-xl font-semibold text-[#86d28e]">{currency.format(totalPaid)}</p>
          </div>
          <div>
            <p className="text-[#b8b493]">Total share</p>
            <p className="text-xl font-semibold text-[#fff9bf]">{currency.format(totalShare)}</p>
          </div>
        </div>
      </div>

      {categorySpend.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorySpend.map((entry) => (
            <div key={entry.category} className="rounded-lg border-2 border-[#8f8c72] bg-[#48483f] p-4">
              <p className="truncate text-sm font-semibold uppercase tracking-wide text-[#b8b493]">{entry.category}</p>
              <p className="mt-2 text-2xl font-bold text-[#ff8667]">{currency.format(entry.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {memberExpenses.length === 0 && (
        <p className="rounded-lg border-2 border-[#8f8c72] p-5 text-center text-xl text-[#d8d4b4]">
          No expenses for {name} in this {periodMode} period.
        </p>
      )}

      {Object.entries(grouped).map(([label, items]) => (
        <div key={label}>
          <h3 className="border-b-2 border-[#8f8c72] pb-2 text-xl font-bold">{label}</h3>
          <div className="divide-y divide-[#6f6d5a]">
            {items.map((expense) => {
              const share = expense.participants.find((p) => p.memberId === memberId)?.share ?? 0;
              const isPayer = expense.paidBy === memberId;
              const creator = expense.createdBy ?? expense.paidBy;
              return (
                <article key={expense.id} className="flex items-start gap-3 py-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#c91f26] text-white">
                    <Utensils size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-[#fff9bf]">{expense.title || expense.category}</h4>
                    <p className="mt-1 text-sm text-[#d8d4b4]">
                      {isPayer ? (
                        <>Paid {currency.format(expense.amount)}</>
                      ) : (
                        <>Share {currency.format(share)}</>
                      )}
                      {' · '}Added by {memberName(members, creator)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#b8b493]">{expense.category}</p>
                  </div>
                  <p className={`shrink-0 font-semibold ${isPayer ? 'text-[#86d28e]' : 'text-[#ff8667]'}`}>
                    {isPayer ? '+' : '-'}{currency.format(isPayer ? expense.amount : share)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
