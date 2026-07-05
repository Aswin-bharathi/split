import { Schema, model } from 'mongoose';

const settlementRecordSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    groupId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['partial', 'settled'], required: true },
    periodKey: { type: String, required: true, index: true },
    createdAt: { type: String, required: true }
  },
  { versionKey: false }
);

settlementRecordSchema.index({ groupId: 1, periodKey: 1, from: 1, to: 1 });

export const SettlementRecord = model('SettlementRecord', settlementRecordSchema);
