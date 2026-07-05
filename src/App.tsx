import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Landmark,
  LogOut,
  MoreHorizontal,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  Tag,
  WalletCards,
  X
} from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseTimeline } from './components/ExpenseTimeline';
import { LoginScreen } from './components/LoginScreen';
import { MemberHistory } from './components/MemberHistory';
import { SettlementPlan } from './components/SettlementPlan';
import { SettlementSummary } from './components/SettlementSummary';
import { currency, memberName } from './lib/utils';
import { nameToUsername } from './lib/username';
import {
  formatPeriodLabel,
  getPeriodKey,
  getDefaultAnchor,
  getPeriodRange,
  isDateInPeriod,
  shiftPeriod,
  type PeriodMode
} from './lib/period';
import {
  isAdmin,
  selectActiveGroup,
  selectBalancesForExpenses,
  selectGroupExpenses,
  selectOutstandingBalancesForExpenses,
  selectRelationshipSettlementsForExpenses,
  selectSettlementsForExpenses,
  useSplitNestStore
} from './store/useSplitNestStore';
import type { Category, Expense } from './lib/types';

type Tab = 'records' | 'analysis' | 'budgets' | 'accounts' | 'categories' | 'reports';
type SettlementMode = 'relationship' | 'simplified';

const Analytics = lazy(() => import('./components/Analytics').then((module) => ({ default: module.Analytics })));

const navItems: { tab: Tab; label: string; icon: typeof ClipboardList }[] = [
  { tab: 'records', label: 'Records', icon: ClipboardList },
  { tab: 'analysis', label: 'Analysis', icon: PieIcon },
  { tab: 'budgets', label: 'Budgets', icon: Calculator },
  { tab: 'accounts', label: 'Accounts', icon: WalletCards },
  { tab: 'categories', label: 'Categories', icon: Tag },
  { tab: 'reports', label: 'Reports', icon: FileText }
];

export default function App() {
  const state = useSplitNestStore();
  const group = selectActiveGroup(state);
  const expenses = selectGroupExpenses(state);
  const userIsAdmin = isAdmin(state);
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');
  const [periodAnchor, setPeriodAnchor] = useState(() => getDefaultAnchor('weekly'));
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'group' | 'individual'>('group');
  const [reportMemberId, setReportMemberId] = useState('');
  const [settlementMode, setSettlementMode] = useState<SettlementMode>('relationship');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await state.checkAuth();
      if (ok) await state.hydrate();
      else useSplitNestStore.setState({ loading: false });
    })();
  }, []);

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodRange(periodMode, periodAnchor),
    [periodMode, periodAnchor]
  );
  const periodKey = useMemo(
    () => getPeriodKey(periodMode, periodStart, periodEnd),
    [periodMode, periodStart, periodEnd]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((expense) => isDateInPeriod(expense.date, periodStart, periodEnd)),
    [expenses, periodStart, periodEnd]
  );

  const balances = useMemo(
    () => selectOutstandingBalancesForExpenses(state, periodExpenses, periodKey),
    [state, periodExpenses, periodKey]
  );

  const simplifiedSettlements = useMemo(
    () => selectSettlementsForExpenses(state, periodExpenses, periodKey),
    [state, periodExpenses, periodKey]
  );
  const relationshipSettlements = useMemo(
    () => selectRelationshipSettlementsForExpenses(state, periodExpenses, periodKey),
    [state, periodExpenses, periodKey]
  );
  const settlements = settlementMode === 'relationship' ? relationshipSettlements : simplifiedSettlements;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleExpenses = useMemo(
    () =>
      periodExpenses
        .filter((expense) => (categoryFilter ? expense.category === categoryFilter : true))
        .filter((expense) => {
          if (!normalizedSearch) return true;
          return [expense.title, expense.category, expense.notes, memberName(state.members, expense.paidBy)]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        })
        .sort((a, b) => {
          const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
          return sortNewestFirst ? diff : -diff;
        }),
    [periodExpenses, normalizedSearch, categoryFilter, sortNewestFirst, state.members]
  );

  const totalExpense = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const activeMembers = state.members.filter((member) => group?.members.includes(member.id));
  const budgetLimit = group?.budgetLimit ?? 5000;

  const categoryTotals = useMemo(
    () =>
      state.expenseCategories
        .map((category) => ({
          category,
          amount: periodExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0)
        }))
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [periodExpenses, state.expenseCategories]
  );

  const groupActivityLogs = useMemo(() => {
    const logs = state.activityLogs.filter((log) => !log.groupId || log.groupId === group?.id);
    if (userIsAdmin) return logs;
    return logs.filter((log) => log.userId === state.currentUserId);
  }, [state.activityLogs, state.currentUserId, group?.id, userIsAdmin]);

  useEffect(() => {
    if (!reportMemberId && activeMembers.length > 0) setReportMemberId(activeMembers[0].id);
    if (reportMemberId && !activeMembers.some((member) => member.id === reportMemberId)) {
      setReportMemberId(activeMembers[0]?.id ?? '');
    }
  }, [activeMembers, reportMemberId]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setActionError(null);
    setSaving(true);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }, []);

  const openEntry = (expense?: Expense, category?: string) => {
    setEditingExpense(expense ?? null);
    setShowEntry(true);
    if (category && !expense) {
      // pre-fill handled inside form via key remount if needed
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveExpense = async (draft: Parameters<typeof state.addExpense>[0]) => {
    await runAction(async () => {
      if (editingExpense) await state.updateExpense(editingExpense.id, draft);
      else await state.addExpense(draft);
      setEditingExpense(null);
      setShowEntry(false);
      setActiveTab('records');
    });
  };

  const changePeriodMode = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setPeriodAnchor(getDefaultAnchor(mode));
  };

  const filterByCategory = (category: string) => {
    setCategoryFilter((current) => (current === category ? null : category));
    setActiveTab('records');
    setSearchOpen(false);
  };

  if (state.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#3f3f3e] text-[#fff9bf]">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 size-10 animate-spin" />
          <p className="text-xl">Loading SplitNest...</p>
        </div>
      </div>
    );
  }

  if (!state.authenticated && state.authChecked) {
    return (
      <LoginScreen
        onLogin={(username, password) => state.login(username, password)}
        error={state.error}
      />
    );
  }

  if (state.error && !state.apiConnected) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#3f3f3e] p-6 text-[#fff9bf]">
        <div className="max-w-md rounded-xl border-2 border-[#ff8667] p-8 text-center">
          <p className="mb-4 text-xl font-semibold text-[#ff8667]">Connection Error</p>
          <p className="mb-6 text-[#d8d4b4]">{state.error}</p>
          <button className="my-btn px-6 py-3" onClick={() => state.hydrate()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#3f3f3e] text-[#fff9bf] lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-[#6f6d5a] lg:bg-[#48483f]">
        <div className="border-b border-[#6f6d5a] px-6 py-8">
          <h1 className="font-serif text-3xl font-bold italic text-[#f5ff8f]">SplitNest</h1>
          <p className="mt-2 text-sm text-[#d8d4b4]">Shared expense manager</p>
          {state.currentUser && (
            <p className="mt-3 text-sm text-[#d8d4b4]">
              Signed in as <span className="font-semibold text-[#fff9bf]">{state.currentUser.name}</span>
              {userIsAdmin && <span className="ml-2 rounded bg-[#fff27c]/20 px-2 py-0.5 text-xs font-bold text-[#fff27c]">ADMIN</span>}
            </p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold transition ${
                activeTab === tab ? 'bg-[#5b5b52] text-[#fff27c]' : 'text-[#c8c4a1] hover:bg-[#56564f]'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#6f6d5a] p-4">
          <label className="mb-2 block text-xs uppercase tracking-wide text-[#b8b493]">Active Group</label>
          <select
            className="w-full rounded-lg border-2 border-[#b8b493] bg-[#3f3f3e] px-3 py-2 outline-none"
            value={group?.id ?? ''}
            onChange={(event) => state.setActiveGroup(event.target.value)}
          >
            {state.groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#ff8667]/50 px-4 py-2 text-sm font-semibold text-[#ff8667] transition hover:bg-[#ff8667]/10"
            onClick={() => state.logout()}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-hidden pb-28 shadow-xl lg:pb-8">
          {actionError && (
            <div className="mx-3 mt-3 flex items-center justify-between rounded-lg border-2 border-[#ff8667] bg-[#48483f] px-4 py-3 sm:mx-5">
              <p className="text-sm text-[#ff8667]">{actionError}</p>
              <button onClick={() => setActionError(null)} aria-label="Dismiss"><X size={18} /></button>
            </div>
          )}

          {showEntry ? (
            <ExpenseForm
              members={activeMembers}
              editingExpense={editingExpense}
              expenseCategories={state.expenseCategories}
              onCancelEdit={() => { setEditingExpense(null); setShowEntry(false); }}
              onSubmit={saveExpense}
              saving={saving}
            />
          ) : (
            <>
              <AppHeader
                groupName={group?.name ?? 'Group'}
                totalExpense={totalExpense}
                periodMode={periodMode}
                periodLabel={formatPeriodLabel(periodMode, periodAnchor)}
                searchOpen={searchOpen}
                searchTerm={searchTerm}
                categoryFilter={categoryFilter}
                periodFilterOpen={periodFilterOpen}
                activeGroupId={group?.id ?? ''}
                groups={state.groups}
                onGroupChange={state.setActiveGroup}
                onPrevPeriod={() => setPeriodAnchor((current) => shiftPeriod(periodMode, current, -1))}
                onNextPeriod={() => setPeriodAnchor((current) => shiftPeriod(periodMode, current, 1))}
                onToggleSearch={() => setSearchOpen((open) => !open)}
                onSearchChange={setSearchTerm}
                onClearCategoryFilter={() => setCategoryFilter(null)}
                onPeriodModeChange={changePeriodMode}
                onTogglePeriodFilter={() => setPeriodFilterOpen((open) => !open)}
                onClosePeriodFilter={() => setPeriodFilterOpen(false)}
                onMenu={() => setDrawerOpen(true)}
                showGroupSelect={false}
                apiConnected={state.apiConnected}
              />

              <section className="px-3 pt-6 sm:px-5 sm:pt-8 lg:px-8">
                {activeTab === 'records' && (
                  <div className="space-y-6">
                    <SettlementSummary
                      balances={balances}
                      members={state.members}
                      periodMode={periodMode}
                      totalExpense={totalExpense}
                    />
                    <SettlementPlan
                      balances={balances}
                      settlements={settlements}
                      members={state.members}
                      totalExpense={totalExpense}
                      memberCount={group?.members.length ?? 0}
                    />
                    <ExpenseTimeline
                      expenses={visibleExpenses}
                      members={state.members}
                      canManage={userIsAdmin}
                      onDelete={(id) => runAction(() => state.deleteExpense(id))}
                      onDuplicate={(id) => runAction(() => state.duplicateExpense(id))}
                      onEdit={openEntry}
                    />
                  </div>
                )}

                {activeTab === 'analysis' && (
                  selectedMemberId ? (
                    <MemberHistory
                      memberId={selectedMemberId}
                      memberName={memberName(state.members, selectedMemberId)}
                      expenses={periodExpenses}
                      members={state.members}
                      periodMode={periodMode}
                      expenseCategories={state.expenseCategories}
                      onBack={() => setSelectedMemberId(null)}
                    />
                  ) : (
                    <div className="space-y-7 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
                      <Suspense fallback={<p className="rounded-lg border-2 border-[#8f8c72] p-5 text-center text-xl text-[#d8d4b4]">Loading analysis...</p>}>
                        <Analytics expenses={periodExpenses} members={state.members} balances={balances} />
                      </Suspense>
                      <div className="space-y-6">
                        <AccountAnalysis
                          balances={balances}
                          members={state.members}
                          onMemberClick={setSelectedMemberId}
                        />
                        <SettlementPlan
                          balances={balances}
                          settlements={settlements}
                          members={state.members}
                          totalExpense={totalExpense}
                          memberCount={group?.members.length ?? 0}
                        />
                      </div>
                    </div>
                  )
                )}

                {activeTab === 'budgets' && (
                  <BudgetSettlements
                    settlements={settlements}
                    balances={balances}
                    members={state.members}
                    totalExpense={totalExpense}
                    periodMode={periodMode}
                    periodKey={periodKey}
                    settlementMode={settlementMode}
                    budgetLimit={budgetLimit}
                    saving={saving}
                    settlementHistory={groupActivityLogs.filter((log) => log.entity === 'settlement')}
                    onSettlementModeChange={setSettlementMode}
                    onPartial={(from, to, amount) => runAction(() => state.markSettlementPartial(from, to, amount, periodKey))}
                    onSettle={(from, to, amount) => runAction(() => state.markSettlementSettled(from, to, amount, periodKey))}
                    onHistory={() => setDrawerOpen(true)}
                  />
                )}

                {activeTab === 'accounts' && (
                  <AccountsScreen
                    balances={balances}
                    members={state.members}
                    activeMemberIds={group?.members ?? []}
                    isAdmin={userIsAdmin}
                    currentUserId={state.currentUserId}
                    onAdd={() => setAccountDialogOpen(true)}
                    onRemove={(id) => runAction(() => state.removeMember(id))}
                  />
                )}

                {activeTab === 'categories' && (
                  <CategoriesScreen
                    categoryTotals={categoryTotals}
                    expenses={periodExpenses}
                    members={state.members}
                    expenseCategories={state.expenseCategories}
                    newCategoryName={newCategoryName}
                    onNewCategoryName={setNewCategoryName}
                    onAddCategory={() =>
                      runAction(async () => {
                        const name = newCategoryName.trim();
                        if (!name) return;
                        await state.addCategory(name, 'expense');
                        setNewCategoryName('');
                      })
                    }
                    onCategoryClick={filterByCategory}
                    onAddExpense={() => openEntry()}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsScreen
                    expenses={periodExpenses}
                    members={activeMembers}
                    periodMode={periodMode}
                    periodLabel={formatPeriodLabel(periodMode, periodAnchor)}
                    reportType={reportType}
                    selectedMemberId={reportMemberId}
                    onPeriodModeChange={changePeriodMode}
                    onReportTypeChange={setReportType}
                    onMemberChange={setReportMemberId}
                  />
                )}
              </section>

              {drawerOpen && (
                <SideDrawer
                  notifications={state.notifications}
                  activityLogs={groupActivityLogs}
                  members={state.members}
                  onClose={() => setDrawerOpen(false)}
                />
              )}

              {accountDialogOpen && (
                <Modal title="ADD NEW MEMBER" onClose={() => { setAccountDialogOpen(false); setNewMemberPassword(''); }}>
                  <div className="space-y-4">
                    <input
                      className="my-input w-full"
                      placeholder="Member name"
                      value={newMemberName}
                      onChange={(event) => setNewMemberName(event.target.value)}
                    />
                    <input
                      type="password"
                      className="my-input w-full"
                      placeholder="Set password for member"
                      value={newMemberPassword}
                      onChange={(event) => setNewMemberPassword(event.target.value)}
                    />
                    <p className="text-xs text-[#b8b493]">
                      {newMemberName.trim()
                        ? `Username: ${nameToUsername(newMemberName.trim()) || '(invalid name)'}`
                        : 'Username will be the name without spaces, lowercase (e.g. Hari Prasath → hariprasath).'}
                    </p>
                    <button
                      className="my-btn w-full py-4 text-2xl"
                      disabled={saving}
                      onClick={() =>
                        runAction(async () => {
                          const name = newMemberName.trim();
                          const password = newMemberPassword.trim();
                          if (!name || !password) return;
                          await state.addMember(name, password);
                          setNewMemberName('');
                          setNewMemberPassword('');
                          setAccountDialogOpen(false);
                        })
                      }
                    >
                      {saving ? 'SAVING...' : 'SAVE MEMBER'}
                    </button>
                  </div>
                </Modal>
              )}
            </>
          )}
        </main>

        {!showEntry && (
          <>
            <button
              className="fixed bottom-24 right-5 z-20 grid size-16 place-items-center rounded-full bg-[#5b5b52] text-5xl leading-none text-[#fff27c] shadow-lg transition hover:bg-[#6a6a5f] sm:bottom-28 sm:right-8 sm:size-20 lg:bottom-8 lg:right-8"
              onClick={() => openEntry()}
              aria-label="Add expense"
            >
              +
            </button>
            <BottomNav activeTab={activeTab} onChange={setActiveTab} />
          </>
        )}
      </div>
    </div>
  );
}

function AccountAnalysis({
  balances,
  members,
  onMemberClick
}: {
  balances: ReturnType<typeof selectBalancesForExpenses>;
  members: ReturnType<typeof useSplitNestStore.getState>['members'];
  onMemberClick: (memberId: string) => void;
}) {
  return (
    <section className="space-y-5">
      <MyMoneyTitle>PER-PERSON BREAKDOWN</MyMoneyTitle>
      <p className="text-sm text-[#b8b493]">Tap a member to view their expense history (daily or weekly).</p>
      <div className="divide-y divide-[#8f8c72] border-y border-[#8f8c72]">
        {balances.map((balance) => {
          const owes = balance.balance < -0.009;
          const receives = balance.balance > 0.009;
          return (
            <button
              key={balance.memberId}
              type="button"
              className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-[#48483f]/50"
              onClick={() => onMemberClick(balance.memberId)}
            >
              <MoneyIcon />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[clamp(1.2rem,5vw,1.5rem)] font-semibold">{memberName(members, balance.memberId)}</h3>
                <p className="mt-2 text-sm text-[#d8d4b4]">
                  Paid <span className="font-semibold text-[#86d28e]">{currency.format(balance.paid)}</span>
                  {' · '}Share <span className="font-semibold text-[#fff9bf]">{currency.format(balance.consumed)}</span>
                </p>
                <p className="mt-1 text-[clamp(1rem,4.5vw,1.25rem)] font-semibold">
                  {owes && <>Owes <span className="text-[#ff8667]">{currency.format(Math.abs(balance.balance))}</span></>}
                  {receives && <>Receives <span className="text-[#86d28e]">{currency.format(balance.balance)}</span></>}
                  {!owes && !receives && <span className="text-[#86d28e]">All settled</span>}
                </p>
              </div>
              <ChevronRight className="shrink-0 text-[#b8b493]" size={24} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BudgetSettlements({
  settlements, balances, members, totalExpense, periodMode, periodKey, settlementMode, saving,
  onSettlementModeChange, onSettle, onPartial, onHistory, settlementHistory
}: {
  settlements: ReturnType<typeof selectSettlementsForExpenses>;
  balances: ReturnType<typeof selectBalancesForExpenses>;
  members: ReturnType<typeof useSplitNestStore.getState>['members'];
  totalExpense: number; periodMode: PeriodMode; periodKey: string; budgetLimit: number; saving: boolean;
  settlementMode: SettlementMode; onSettlementModeChange: (mode: SettlementMode) => void;
  onSettle: (from: string, to: string, amount: number) => void; onPartial: (from: string, to: string, amount: number) => void; onHistory: () => void;
  settlementHistory: ReturnType<typeof useSplitNestStore.getState>['activityLogs'];
}) {
  const currentPeriodHistory = settlementHistory.filter((log) => log.action.includes(periodKey));

  return (
    <section className="space-y-6 lg:max-w-3xl">
      <SettlementSummary balances={balances} members={members} periodMode={periodMode} totalExpense={totalExpense} />
      <MyMoneyTitle>SETTLEMENT DETAILS</MyMoneyTitle>
      <div className="rounded-xl border-2 border-[#8f8c72] bg-[#48483f] p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`rounded-lg border-2 px-3 py-3 text-sm font-semibold transition ${
              settlementMode === 'relationship' ? 'border-[#fff27c] bg-[#fff27c]/10 text-[#fff27c]' : 'border-[#6f6d5a] text-[#d8d4b4]'
            }`}
            onClick={() => onSettlementModeChange('relationship')}
          >
            Relationship
          </button>
          <button
            className={`rounded-lg border-2 px-3 py-3 text-sm font-semibold transition ${
              settlementMode === 'simplified' ? 'border-[#fff27c] bg-[#fff27c]/10 text-[#fff27c]' : 'border-[#6f6d5a] text-[#d8d4b4]'
            }`}
            onClick={() => onSettlementModeChange('simplified')}
          >
            Optimized
          </button>
        </div>
        <p className="mt-3 text-sm text-[#d8d4b4]">
          {settlementMode === 'relationship'
            ? 'Shows direct payback based on who paid for whose share. Best for discussion and clarity.'
            : 'Combines balances into the fewest transfers after everyone agrees to simplify payments.'}
        </p>
      </div>
      <div className="space-y-4">
        {settlements.length === 0 && <p className="text-2xl">Everyone is settled.</p>}
        {settlements.map((settlement) => (
          <article key={`${settlement.from}-${settlement.to}`} className="rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-4">
            <p className="text-[clamp(1.1rem,5vw,1.5rem)]">
              {memberName(members, settlement.from)} owes {memberName(members, settlement.to)}
            </p>
            <p className="my-3 text-[clamp(1.8rem,8vw,2.25rem)] font-semibold text-[#ff8667]">{currency.format(settlement.amount)}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:text-sm">
              <button className="my-btn" disabled={saving} onClick={() => onSettle(settlement.from, settlement.to, settlement.amount)}>SETTLED</button>
              <button className="my-btn" disabled={saving} onClick={() => onPartial(settlement.from, settlement.to, Math.round((settlement.amount / 2) * 100) / 100)}>PARTIAL (50%)</button>
              <button className="my-btn" onClick={onHistory}>HISTORY</button>
            </div>
          </article>
        ))}
      </div>
      {currentPeriodHistory.length > 0 && (
        <div className="rounded-xl border-2 border-[#8f8c72] bg-[#48483f] p-5">
          <h3 className="mb-4 text-2xl font-semibold">Settlement History</h3>
          <div className="space-y-3">
            {currentPeriodHistory.slice(0, 8).map((log) => (
              <p key={log.id} className="border-b border-[#6f6d5a] pb-3 text-sm text-[#d8d4b4] last:border-b-0 last:pb-0">
                <span className="font-semibold text-[#fff9bf]">{memberName(members, log.userId)}</span> {log.action.replace(` for ${periodKey}`, '')}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AccountsScreen({ balances, members, activeMemberIds, isAdmin, currentUserId, onAdd, onRemove }: {
  balances: ReturnType<typeof selectBalancesForExpenses>; members: ReturnType<typeof useSplitNestStore.getState>['members'];
  activeMemberIds: string[]; isAdmin: boolean; currentUserId: string; onAdd: () => void; onRemove: (id: string) => void;
}) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const adminMember = members.find((m) => m.role === 'admin');
  const activeBalances = balances.filter((balance) => activeMemberIds.includes(balance.memberId));

  return (
    <section className="lg:max-w-3xl">
      <h2 className="mb-2 text-3xl font-bold">Roommates</h2>
      <p className="mb-6 text-[#d8d4b4]">
        {adminMember ? `${adminMember.name} is admin and can edit or delete any expense.` : 'Admin can edit or delete any expense.'}{' '}
        All members can add expenses.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {activeBalances.map((balance) => {
          const member = members.find((m) => m.id === balance.memberId);
          const owes = balance.balance < -0.009;
          const receives = balance.balance > 0.009;
          const canRemove = isAdmin && member?.role !== 'admin' && balance.memberId !== currentUserId;
          return (
            <article key={balance.memberId} className="relative flex items-center gap-5 rounded-xl border-2 border-[#8f8c72] bg-[#48483f] p-4">
              <MoneyIcon />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[clamp(1.2rem,5vw,1.5rem)] font-semibold">{memberName(members, balance.memberId)}</h3>
                  {member?.role === 'admin' && (
                    <span className="rounded bg-[#fff27c]/20 px-2 py-0.5 text-xs font-bold text-[#fff27c]">ADMIN</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[#d8d4b4]">
                  Paid: <span className="text-[#86d28e]">{currency.format(balance.paid)}</span>
                  {' · '}Share: <span className="text-[#fff9bf]">{currency.format(balance.consumed)}</span>
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {owes && <span className="text-[#ff8667]">Pay {currency.format(Math.abs(balance.balance))}</span>}
                  {receives && <span className="text-[#86d28e]">Get {currency.format(balance.balance)}</span>}
                  {!owes && !receives && <span className="text-[#86d28e]">Settled</span>}
                </p>
              </div>
              {canRemove && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId((current) => (current === balance.memberId ? null : balance.memberId))}
                    title="Member options"
                    aria-label="Member options"
                    aria-expanded={menuOpenId === balance.memberId}
                  >
                    <MoreHorizontal size={32} />
                  </button>
                  {menuOpenId === balance.memberId && (
                    <>
                      <button
                        className="fixed inset-0 z-10 cursor-default"
                        aria-label="Close menu"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border-2 border-[#8f8c72] bg-[#3f3f3e] shadow-lg">
                        <button
                          className="w-full px-4 py-3 text-left text-sm font-semibold text-[#ff8667] transition hover:bg-[#ff8667]/10"
                          onClick={() => {
                            setMenuOpenId(null);
                            onRemove(balance.memberId);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {isAdmin && (
        <button className="mx-auto mt-6 flex items-center gap-3 rounded-lg border-2 border-[#fff9bf] px-5 py-3 text-[clamp(1.25rem,5.5vw,1.875rem)] font-semibold sm:px-8 sm:py-4" onClick={onAdd}>
          <Plus size={28} /> ADD MEMBER
        </button>
      )}
    </section>
  );
}

function CategoriesScreen({
  categoryTotals, expenses, members, expenseCategories, newCategoryName, onNewCategoryName, onAddCategory, onCategoryClick, onAddExpense
}: {
  categoryTotals: { category: Category; amount: number }[]; expenses: Expense[];
  members: ReturnType<typeof useSplitNestStore.getState>['members']; expenseCategories: string[];
  newCategoryName: string; onNewCategoryName: (v: string) => void; onAddCategory: () => void;
  onCategoryClick: (category: string) => void; onAddExpense: () => void;
}) {
  const categoriesWithTotals = expenseCategories.map((category) => ({
    category,
    amount: categoryTotals.find((item) => item.category === category)?.amount ?? 0
  }));
  const keyCategoryCards = ['Food', 'Eggs', 'Milk']
    .map((category) => ({
      category,
      amount: categoryTotals.find((item) => item.category.toLowerCase() === category.toLowerCase())?.amount ?? 0
    }))
    .filter((entry) => expenseCategories.some((category) => category.toLowerCase() === entry.category.toLowerCase()) || entry.amount > 0);
  const categoryBreakdowns = categoriesWithTotals
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      ...entry,
      people: members
        .map((member) => ({
          member,
          amount: expenses
            .filter((expense) => expense.category === entry.category && expense.paidBy === member.id)
            .reduce((sum, expense) => sum + expense.amount, 0)
        }))
        .filter(({ amount }) => amount > 0)
        .sort((a, b) => b.amount - a.amount)
    }));

  return (
    <section className="space-y-8">
      {keyCategoryCards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {keyCategoryCards.map((entry) => (
            <div key={entry.category} className="rounded-lg border-2 border-[#8f8c72] bg-[#48483f] p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#b8b493]">{entry.category}</p>
              <p className="mt-2 text-2xl font-bold text-[#ff8667]">{currency.format(entry.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {expenseCategories.length === 0 ? (
        <div className="rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-6 text-center text-[#d8d4b4]">
          <p>No categories yet. Add your first category below to start tracking expenses.</p>
        </div>
      ) : (
        <div>
          <h2 className="border-b-2 border-[#8f8c72] pb-3 text-3xl font-bold">Category Analysis</h2>
          <div className="mt-4 space-y-5">
            {categoryBreakdowns.length === 0 && (
              <p className="rounded-lg border-2 border-[#8f8c72] p-5 text-center text-xl text-[#d8d4b4]">
                No category spending in this period.
              </p>
            )}
            {categoryBreakdowns.map((entry) => (
              <article key={entry.category} className="rounded-xl border-2 border-[#8f8c72] bg-[#48483f] p-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => onCategoryClick(entry.category)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-semibold">{entry.category}</p>
                    <p className="mt-1 text-sm text-[#b8b493]">Tap to view matching records</p>
                  </div>
                  <p className="shrink-0 text-2xl font-bold text-[#ff8667]">{currency.format(entry.amount)}</p>
                </button>
                <div className="mt-4 divide-y divide-[#6f6d5a]">
                  {entry.people.map(({ member, amount }) => (
                    <div key={member.id} className="flex items-center justify-between gap-4 py-3">
                      <p className="min-w-0 truncate font-semibold text-[#fff9bf]">{member.name}</p>
                      <p className="shrink-0 font-semibold text-[#86d28e]">{currency.format(amount)}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 rounded-xl border-2 border-[#8f8c72] p-4">
        <input className="my-input" placeholder="New category name" value={newCategoryName} onChange={(event) => onNewCategoryName(event.target.value)} />
        <button className="my-btn py-3 text-xl" onClick={onAddCategory}>ADD CATEGORY</button>
      </div>
      <button className="my-btn mx-auto flex items-center gap-2 px-5 py-3 text-[clamp(1.1rem,5vw,1.5rem)] sm:px-8 sm:py-4" onClick={onAddExpense}>
        <Plus /> ADD EXPENSE
      </button>
    </section>
  );
}

function SideDrawer({ notifications, activityLogs, members, onClose }: {
  notifications: ReturnType<typeof useSplitNestStore.getState>['notifications'];
  activityLogs: ReturnType<typeof useSplitNestStore.getState>['activityLogs'];
  members: ReturnType<typeof useSplitNestStore.getState>['members']; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 bg-black/45 lg:bg-black/30" onClick={onClose}>
      <aside className="h-full w-[min(88vw,360px)] bg-[#48483f] p-5 text-[#fff9bf] shadow-2xl lg:w-96" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold">SplitNest</h2>
          <button onClick={onClose} aria-label="Close menu"><X size={28} /></button>
        </div>
        <section className="mb-7">
          <h3 className="mb-3 border-b border-[#8f8c72] pb-2 text-xl font-semibold">Notifications</h3>
          <div className="max-h-48 space-y-3 overflow-y-auto">
            {notifications.length === 0 && <p className="text-sm text-[#d8d4b4]">No notifications yet.</p>}
            {notifications.slice(0, 8).map((n) => (
              <div key={n.id} className="rounded-lg border border-[#8f8c72] p-3">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-[#d8d4b4]">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 border-b border-[#8f8c72] pb-2 text-xl font-semibold">Activity</h3>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {activityLogs.length === 0 && <p className="text-sm text-[#d8d4b4]">No activity yet.</p>}
            {activityLogs.slice(0, 12).map((log) => (
              <p key={log.id} className="text-sm text-[#d8d4b4]">
                <span className="font-semibold text-[#fff9bf]">{memberName(members, log.userId)}</span> {log.action}
              </p>
            ))}
          </div>
        </section>
        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#ff8667]/50 py-3 text-sm font-semibold text-[#ff8667]"
          onClick={() => { useSplitNestStore.getState().logout(); onClose(); }}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <section className="w-full max-w-sm rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-5 text-[#fff9bf] lg:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog"><X size={24} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function CategoryList({ title, items, totals, onItemClick }: {
  title: string; items: string[]; totals?: { category: Category; amount: number }[];
  onItemClick: (category: string) => void;
}) {
  return (
    <div>
      <h2 className="border-b-2 border-[#8f8c72] pb-3 text-3xl font-bold">{title}</h2>
      <div className="mt-3 space-y-4">
        {items.map((item) => {
          const total = totals?.find((entry) => entry.category === item)?.amount ?? 0;
          return (
            <button
              key={item}
              type="button"
              className="grid w-full grid-cols-[68px_1fr_auto] items-center gap-4 rounded-lg p-2 text-left transition hover:bg-[#48483f]"
              onClick={() => onItemClick(item)}
            >
              <span className="grid size-14 place-items-center rounded-full bg-[#c91f26] sm:size-16">
                <Tag size={32} />
              </span>
              <div>
                <p className="truncate text-[clamp(1.4rem,6vw,1.875rem)] font-semibold">{item}</p>
                {total > 0 && <p className="text-xl text-[#ff8667]">{currency.format(total)}</p>}
              </div>
              <span className="text-xs text-[#b8b493]">View</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportsScreen({
  expenses,
  members,
  periodMode,
  periodLabel,
  reportType,
  selectedMemberId,
  onPeriodModeChange,
  onReportTypeChange,
  onMemberChange
}: {
  expenses: Expense[];
  members: ReturnType<typeof useSplitNestStore.getState>['members'];
  periodMode: PeriodMode;
  periodLabel: string;
  reportType: 'group' | 'individual';
  selectedMemberId: string;
  onPeriodModeChange: (mode: PeriodMode) => void;
  onReportTypeChange: (type: 'group' | 'individual') => void;
  onMemberChange: (memberId: string) => void;
}) {
  const [generated, setGenerated] = useState(false);
  const reportExpenses = useMemo(
    () =>
      (reportType === 'individual'
        ? expenses.filter((expense) => expense.paidBy === selectedMemberId)
        : expenses
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses, reportType, selectedMemberId]
  );
  const total = reportExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryRows = Object.entries(
    reportExpenses.reduce<Record<string, { amount: number; count: number }>>((acc, expense) => {
      const current = acc[expense.category] ?? { amount: 0, count: 0 };
      acc[expense.category] = { amount: current.amount + expense.amount, count: current.count + 1 };
      return acc;
    }, {})
  )
    .map(([category, data]) => ({
      category,
      count: data.count,
      amount: data.amount,
      percent: total ? (data.amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
  const personRows = members
    .map((member) => {
      const memberExpenses = reportExpenses.filter((expense) => expense.paidBy === member.id);
      const amount = memberExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      return {
        member,
        amount,
        count: memberExpenses.length,
        percent: total ? (amount / total) * 100 : 0
      };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const highestCategory = categoryRows[0]?.category ?? 'None';
  const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const selectedMemberName = memberName(members, selectedMemberId);

  const ensureGenerated = () => setGenerated(true);
  const downloadCsv = () => {
    ensureGenerated();
    const rows = [
      ['Date', 'Person Name', 'Category', 'Expense Description', 'Amount', 'Notes'],
      ...reportExpenses.map((expense) => [
        expense.date,
        memberName(members, expense.paidBy),
        expense.category,
        expense.title || expense.description || expense.category,
        String(expense.amount),
        expense.notes ?? ''
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `splitnest-${reportType}-report-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadPdf = () => {
    ensureGenerated();
    const html = buildReportHtml({
      reportType,
      periodLabel,
      generatedAt,
      selectedMemberName,
      total,
      transactionCount: reportExpenses.length,
      categoryRows,
      personRows,
      highestCategory,
      expenses: reportExpenses,
      members
    });
    printReportHtml(html);
  };

  return (
    <section className="space-y-6">
      <MyMoneyTitle>REPORTS</MyMoneyTitle>
      <div className="grid gap-4 rounded-xl border-2 border-[#8f8c72] bg-[#48483f] p-5 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#b8b493]">Report Period</label>
          <div className="grid grid-cols-2 gap-2">
            {(['weekly', 'monthly'] as PeriodMode[]).map((mode) => (
              <button
                key={mode}
                className={`rounded-lg border-2 px-4 py-3 font-semibold capitalize ${
                  periodMode === mode ? 'border-[#fff27c] bg-[#fff27c]/10 text-[#fff27c]' : 'border-[#6f6d5a] text-[#d8d4b4]'
                }`}
                onClick={() => onPeriodModeChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-[#d8d4b4]">Selected range: {periodLabel}</p>
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#b8b493]">Report Type</label>
          <select
            className="my-input w-full"
            value={reportType}
            onChange={(event) => onReportTypeChange(event.target.value as 'group' | 'individual')}
          >
            <option value="group">Group</option>
            <option value="individual">Individual</option>
          </select>
        </div>
        {reportType === 'individual' && (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#b8b493]">Person</label>
            <select className="my-input w-full" value={selectedMemberId} onChange={(event) => onMemberChange(event.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3 lg:col-span-2">
          <button className="my-btn flex items-center justify-center gap-2 py-3" onClick={ensureGenerated}>
            <FileText size={20} /> GENERATE
          </button>
          <button className="my-btn flex items-center justify-center gap-2 py-3" onClick={downloadPdf}>
            <Download size={20} /> PDF
          </button>
          <button className="my-btn flex items-center justify-center gap-2 py-3" onClick={downloadCsv}>
            <Download size={20} /> EXCEL
          </button>
        </div>
      </div>

      {generated && (
        <div className="space-y-5 rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#8f8c72] pb-4">
            <div>
              <p className="font-serif text-3xl font-bold italic text-[#f5ff8f]">SplitNest</p>
              <p className="mt-1 text-xl font-semibold">Expense Report</p>
              <p className="text-sm text-[#d8d4b4]">{reportType === 'group' ? 'Group' : `Individual: ${selectedMemberName}`} · {periodLabel}</p>
            </div>
            <p className="text-sm text-[#b8b493]">Generated {generatedAt}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ReportMetric label="Total Expenses" value={currency.format(total)} />
            <ReportMetric label="Transactions" value={String(reportExpenses.length)} />
            <ReportMetric label="Categories" value={String(categoryRows.length)} />
            <ReportMetric label="Top Category" value={highestCategory} />
            <ReportMetric label="Average" value={currency.format(reportExpenses.length ? total / reportExpenses.length : 0)} />
          </div>
          <ReportTable
            title="Category-wise Summary"
            headers={['Category', 'Transactions', 'Amount', 'Share']}
            rows={categoryRows.map((row) => [row.category, String(row.count), currency.format(row.amount), `${row.percent.toFixed(1)}%`])}
          />
          {reportType === 'group' && (
            <ReportTable
              title="Person-wise Summary"
              headers={['Person', 'Transactions', 'Amount', 'Contribution']}
              rows={personRows.map((row) => [row.member.name, String(row.count), currency.format(row.amount), `${row.percent.toFixed(1)}%`])}
            />
          )}
          <ReportTable
            title="Detailed Expense Records"
            headers={['Date', 'Person', 'Category', 'Description', 'Amount', 'Notes']}
            rows={reportExpenses.map((expense) => [
              expense.date,
              memberName(members, expense.paidBy),
              expense.category,
              expense.title || expense.description || expense.category,
              currency.format(expense.amount),
              expense.notes ?? '-'
            ])}
          />
        </div>
      )}
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#6f6d5a] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#b8b493]">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-[#fff9bf]">{value}</p>
    </div>
  );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div>
      <h3 className="mb-3 text-2xl font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-[#8f8c72]">
        <table className="min-w-full divide-y divide-[#8f8c72] text-sm">
          <thead className="bg-[#56564f]">
            <tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-left font-semibold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#6f6d5a]">
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-center text-[#d8d4b4]" colSpan={headers.length}>No data for this period.</td></tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3 text-[#d8d4b4]">{cell}</td>)}</tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char] ?? char));
}

function buildReportHtml({
  reportType,
  periodLabel,
  generatedAt,
  selectedMemberName,
  total,
  transactionCount,
  categoryRows,
  personRows,
  highestCategory,
  expenses,
  members
}: {
  reportType: 'group' | 'individual';
  periodLabel: string;
  generatedAt: string;
  selectedMemberName: string;
  total: number;
  transactionCount: number;
  categoryRows: { category: string; count: number; amount: number; percent: number }[];
  personRows: { member: { name: string }; amount: number; count: number; percent: number }[];
  highestCategory: string;
  expenses: Expense[];
  members: ReturnType<typeof useSplitNestStore.getState>['members'];
}) {
  const rowHtml = (cells: string[]) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
  const tableHtml = (title: string, headers: string[], rows: string[][]) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(rowHtml).join('') : `<tr><td colspan="${headers.length}">No data for this period.</td></tr>`}</tbody>
      </table>
    </section>`;

  return `<!doctype html>
<html>
<head>
  <title>SplitNest Expense Report</title>
  <style>
    @page { margin: 18mm; @bottom-center { content: "SplitNest · Page " counter(page); } }
    body { color: #1f2933; font-family: Arial, sans-serif; margin: 0; }
    header { border-bottom: 3px solid #2f3a45; margin-bottom: 24px; padding-bottom: 18px; }
    .brand { color: #2f3a45; font-size: 30px; font-style: italic; font-weight: 700; }
    .meta { color: #52606d; margin-top: 6px; }
    .summary { display: grid; gap: 12px; grid-template-columns: repeat(5, 1fr); margin: 18px 0 24px; }
    .card { border: 1px solid #d9e2ec; border-radius: 8px; padding: 12px; }
    .label { color: #627d98; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .value { font-size: 18px; font-weight: 700; margin-top: 8px; }
    h1 { font-size: 24px; margin: 8px 0 0; }
    h2 { border-bottom: 1px solid #d9e2ec; font-size: 18px; margin: 24px 0 10px; padding-bottom: 8px; }
    table { border-collapse: collapse; font-size: 12px; margin-bottom: 12px; width: 100%; }
    th { background: #f0f4f8; color: #243b53; text-align: left; }
    th, td { border: 1px solid #d9e2ec; padding: 8px; vertical-align: top; }
    footer { border-top: 1px solid #d9e2ec; color: #627d98; display: flex; justify-content: space-between; margin-top: 28px; padding-top: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">SplitNest</div>
    <h1>Expense Report</h1>
    <div class="meta">${escapeHtml(reportType === 'group' ? 'Group Report' : `Individual Report · ${selectedMemberName}`)}</div>
    <div class="meta">Period: ${escapeHtml(periodLabel)} · Generated: ${escapeHtml(generatedAt)}</div>
  </header>
  <section class="summary">
    <div class="card"><div class="label">Total Expenses</div><div class="value">${currency.format(total)}</div></div>
    <div class="card"><div class="label">Transactions</div><div class="value">${transactionCount}</div></div>
    <div class="card"><div class="label">Categories</div><div class="value">${categoryRows.length}</div></div>
    <div class="card"><div class="label">Top Category</div><div class="value">${escapeHtml(highestCategory)}</div></div>
    <div class="card"><div class="label">Average</div><div class="value">${currency.format(transactionCount ? total / transactionCount : 0)}</div></div>
  </section>
  ${tableHtml('Category-wise Summary', ['Category', 'Transactions', 'Amount', 'Share'], categoryRows.map((row) => [row.category, String(row.count), currency.format(row.amount), `${row.percent.toFixed(1)}%`]))}
  ${reportType === 'group' ? tableHtml('Person-wise Summary', ['Person', 'Transactions', 'Amount', 'Contribution'], personRows.map((row) => [row.member.name, String(row.count), currency.format(row.amount), `${row.percent.toFixed(1)}%`])) : ''}
  ${tableHtml('Detailed Expense Records', ['Date', 'Person', 'Category', 'Description', 'Amount', 'Notes'], expenses.map((expense) => [
    expense.date,
    memberName(members, expense.paidBy),
    expense.category,
    expense.title || expense.description || expense.category,
    currency.format(expense.amount),
    expense.notes ?? '-'
  ]))}
  <footer><strong>Grand Total: ${currency.format(total)}</strong><span>${escapeHtml(generatedAt)} · SplitNest</span></footer>
</body>
</html>`;
}

function printReportHtml(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const removeFrame = () => {
    setTimeout(() => iframe.remove(), 1000);
  };
  let printed = false;
  const printFrame = () => {
    if (printed) return;
    printed = true;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    removeFrame();
  };

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  iframe.onload = () => setTimeout(printFrame, 150);
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(printFrame, 500);
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-20 max-w-6xl grid-cols-6 bg-[#5a5a50] px-1 sm:h-24 sm:px-2 lg:hidden">
      {navItems.map(({ tab, label, icon: Icon }) => {
        const active = activeTab === tab;
        return (
          <button key={tab} className={`grid place-items-center text-[11px] font-semibold sm:text-sm ${active ? 'text-[#fff27c]' : 'text-[#c8c4a1]'}`} onClick={() => onChange(tab)}>
            <Icon className="size-7 sm:size-[34px]" strokeWidth={active ? 2.7 : 2.1} />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MyMoneyTitle({ children }: { children: string }) {
  return (
    <h2 className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-lg border-2 border-[#fff9bf] px-4 py-3 text-center text-[clamp(1.25rem,5.5vw,1.875rem)] font-semibold tracking-wide sm:gap-4 sm:px-8 sm:py-4 lg:mx-0">
      <ChevronRight className="rotate-90" /> {children}
    </h2>
  );
}

function MoneyIcon() {
  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-xl border-2 border-[#8fb373] bg-[#f0ffe9] text-[#5d9e65] sm:size-20">
      <Landmark className="size-9 sm:size-[43px]" />
    </span>
  );
}
