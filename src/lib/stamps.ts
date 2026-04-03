import { connect, type Connection, type Table } from "@lancedb/lancedb";
import { Field, Int32, Schema, Utf8 } from "apache-arrow";

export type CustomerRecord = {
  stamps: number;
  lastVisit: string;
  redeemed: number;
};

type CustomerRow = {
  phone: string;
  stamps: number;
  lastVisit: string;
  redeemed: number;
};

type StampTransactionRow = {
  id: string;
  phone: string;
  type: "stamp_added" | "reward_redeemed";
  stampDelta: number;
  createdAt: string;
  resultingStamps: number;
  redeemedTotal: number;
};

type DbState = {
  connection: Connection;
  customers: Table;
  stampTransactions: Table;
};

const CUSTOMERS_TABLE = "customers";
const STAMP_TRANSACTIONS_TABLE = "stamp_transactions";

const customersSchema = new Schema([
  new Field("phone", new Utf8(), false),
  new Field("stamps", new Int32(), false),
  new Field("lastVisit", new Utf8(), false),
  new Field("redeemed", new Int32(), false),
]);

const stampTransactionsSchema = new Schema([
  new Field("id", new Utf8(), false),
  new Field("phone", new Utf8(), false),
  new Field("type", new Utf8(), false),
  new Field("stampDelta", new Int32(), false),
  new Field("createdAt", new Utf8(), false),
  new Field("resultingStamps", new Int32(), false),
  new Field("redeemedTotal", new Int32(), false),
]);

let dbStatePromise: Promise<DbState> | null = null;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function isoNow(): string {
  return new Date().toISOString();
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function customerFilter(phone: string): string {
  return `phone = '${escapeSqlString(phone)}'`;
}

function rowToCustomerRecord(row: CustomerRow | null): CustomerRecord | null {
  if (!row) {
    return null;
  }

  return {
    stamps: row.stamps,
    lastVisit: row.lastVisit,
    redeemed: row.redeemed,
  };
}

async function openOrCreateTable(
  connection: Connection,
  name: string,
  schema: Schema,
): Promise<Table> {
  try {
    return await connection.openTable(name);
  } catch {
    await connection.createEmptyTable(name, schema, { mode: "create", existOk: true });
    return connection.openTable(name);
  }
}

async function createDbState(): Promise<DbState> {
  const uri = requireEnv("LANCEDB_URI");
  const apiKey = requireEnv("LANCEDB_API_KEY");
  const region = process.env.LANCEDB_REGION;

  const connection = await connect(uri, {
    apiKey,
    ...(region ? { region } : {}),
  });

  const customers = await openOrCreateTable(connection, CUSTOMERS_TABLE, customersSchema);
  const stampTransactions = await openOrCreateTable(
    connection,
    STAMP_TRANSACTIONS_TABLE,
    stampTransactionsSchema,
  );

  return { connection, customers, stampTransactions };
}

async function getDbState(): Promise<DbState> {
  if (!dbStatePromise) {
    dbStatePromise = createDbState().catch((error) => {
      dbStatePromise = null;
      throw error;
    });
  }

  return dbStatePromise;
}

async function findCustomerRow(phone: string): Promise<CustomerRow | null> {
  const { customers } = await getDbState();
  const rows = await customers
    .query()
    .where(customerFilter(phone))
    .select(["phone", "stamps", "lastVisit", "redeemed"])
    .limit(1)
    .toArray();

  return (rows[0] as CustomerRow | undefined) ?? null;
}

async function saveCustomer(row: CustomerRow): Promise<void> {
  const { customers } = await getDbState();

  await customers
    .mergeInsert("phone")
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute([row]);
}

async function logTransaction(row: StampTransactionRow): Promise<void> {
  const { stampTransactions } = await getDbState();
  await stampTransactions.add([row]);
}

function makeTransactionId(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, "");
  return `${Date.now()}-${normalizedPhone}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getCustomer(phone: string): Promise<CustomerRecord | null> {
  const row = await findCustomerRow(phone);
  return rowToCustomerRecord(row);
}

export async function upsertCustomer(phone: string): Promise<CustomerRecord> {
  const existing = await findCustomerRow(phone);
  if (existing) {
    return rowToCustomerRecord(existing)!;
  }

  const created: CustomerRow = {
    phone,
    stamps: 0,
    lastVisit: todayString(),
    redeemed: 0,
  };

  await saveCustomer(created);
  return rowToCustomerRecord(created)!;
}

export async function addStamp(phone: string): Promise<CustomerRecord> {
  const existing = await findCustomerRow(phone);
  const next: CustomerRow = {
    phone,
    stamps: (existing?.stamps ?? 0) + 1,
    lastVisit: todayString(),
    redeemed: existing?.redeemed ?? 0,
  };

  await saveCustomer(next);
  await logTransaction({
    id: makeTransactionId(phone),
    phone,
    type: "stamp_added",
    stampDelta: 1,
    createdAt: isoNow(),
    resultingStamps: next.stamps,
    redeemedTotal: next.redeemed,
  });

  return rowToCustomerRecord(next)!;
}

export async function redeemReward(phone: string): Promise<CustomerRecord | null> {
  const existing = await findCustomerRow(phone);
  if (!existing || existing.stamps < 8) {
    return null;
  }

  const next: CustomerRow = {
    phone,
    stamps: 0,
    lastVisit: todayString(),
    redeemed: existing.redeemed + 1,
  };

  await saveCustomer(next);
  await logTransaction({
    id: makeTransactionId(phone),
    phone,
    type: "reward_redeemed",
    stampDelta: -existing.stamps,
    createdAt: isoNow(),
    resultingStamps: next.stamps,
    redeemedTotal: next.redeemed,
  });

  return rowToCustomerRecord(next);
}

export { STAMPS_REQUIRED } from "@/lib/constants";
