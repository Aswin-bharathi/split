export type SplitMethod = 'equal' | 'quantity' | 'percentage' | 'exact' | 'weighted';

export type Category =
  | 'Food'
  | 'Milk'
  | 'Eggs'
  | (string & {});

export type MemberRole = 'admin' | 'member';

export const ADMIN_USER_ID = 'admin';

export type Member = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedAt: string;
  role?: MemberRole;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  members: string[];
  budgetLimit?: number;
};

export type ParticipantInput = {
  memberId: string;
  quantity?: number;
  percentage?: number;
  exactAmount?: number;
  weight?: number;
};

export type Expense = {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  category: Category;
  paidBy: string;
  createdBy?: string;
  splitMethod: SplitMethod;
  notes?: string;
  receiptUrl?: string;
  participants: ParticipantShare[];
  createdAt: string;
  updatedAt: string;
};

export type ParticipantShare = {
  memberId: string;
  share: number;
  input?: ParticipantInput;
};

export type Balance = {
  memberId: string;
  paid: number;
  consumed: number;
  balance: number;
};

export type Settlement = {
  from: string;
  to: string;
  amount: number;
  status?: 'pending' | 'settled' | 'partial';
  periodKey?: string;
};

export type SettlementRecord = {
  groupId: string;
  from: string;
  to: string;
  amount: number;
  periodKey: string;
  status: 'partial' | 'settled';
};

export type ActivityLog = {
  id: string;
  groupId?: string;
  userId: string;
  action: string;
  entity: string;
  timestamp: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
