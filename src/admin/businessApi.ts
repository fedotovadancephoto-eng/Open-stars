import { fetchStaffIdentity, getValidStaffSession, StaffRole } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const RECEIPT_BUCKET = "business-expense-receipts";

export type BusinessBranch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  categoryType: "fixed" | "variable" | "project";
};

export type ExpenseAttachment = {
  id: string;
  expenseRequestId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";

export type ExpenseRequest = {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  expenseDate: string;
  description: string;
  status: ExpenseStatus;
  requestedByProfileId: string;
  requesterName: string;
  reviewedAt: string;
  reviewComment: string;
  cashflowTransactionId: string;
  createdAt: string;
  attachments: ExpenseAttachment[];
};

export type CashAccount = {
  id: string;
  name: string;
  accountType: "bank" | "cash" | "other";
  branchId: string;
  openingBalance: number;
};

export type CashflowTransaction = {
  id: string;
  transactionDate: string;
  direction: "income" | "expense";
  amount: number;
  description: string;
  branchName: string;
  categoryName: string;
  accountName: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type BusinessExpenseContext = {
  role: StaffRole;
  staffBranch: string;
  branches: BusinessBranch[];
  categories: ExpenseCategory[];
  requests: ExpenseRequest[];
  accounts: CashAccount[];
  cashflow: CashflowTransaction[];
};

type ApiError = { message?: string; details?: string; hint?: string };

async function sessionToken() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return session.access_token;
}

function headers(token: string, extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function restSelect<T>(table: string, query: string, token: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: headers(token),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as ApiError;
      detail = payload.message || payload.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(detail || `Не удалось загрузить ${table}.`);
  }
  return response.json();
}

function friendlyRpcError(message: string) {
  if (message.includes("owner only")) return "Это действие доступно только владельцу.";
  if (message.includes("not authorized")) return "Недостаточно прав для этого действия.";
  if (message.includes("invalid amount")) return "Укажите корректную сумму расхода.";
  if (message.includes("invalid branch")) return "Выберите филиал.";
  if (message.includes("invalid expense category")) return "Выберите категорию расхода.";
  if (message.includes("awaiting approval")) return "Расход уже обработан или отменён.";
  if (message.includes("closed")) return "Этот расход уже закрыт.";
  return message || "Не удалось выполнить действие.";
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const token = await sessionToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(friendlyRpcError(message));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function safeNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function fetchBusinessExpenseContext(): Promise<BusinessExpenseContext> {
  const [identity, token] = await Promise.all([fetchStaffIdentity(), sessionToken()]);
  if (!(["owner", "manager", "project_director", "admin"] as StaffRole[]).includes(identity.role)) {
    throw new Error("Раздел расходов недоступен для этой роли.");
  }

  const [profileRows, branchRows, categoryRows, requestRows, attachmentRows] = await Promise.all([
    restSelect<any>("users_profile", `select=staff_branch&id=eq.${encodeURIComponent(identity.profile.id)}&limit=1`, token),
    restSelect<any>("branches", "select=id,code,name,is_active&is_active=eq.true&order=sort_order.asc,name.asc", token),
    restSelect<any>("expense_categories", "select=id,code,name,category_type&is_active=eq.true&order=sort_order.asc,name.asc", token),
    restSelect<any>(
      "expense_requests",
      "select=id,branch_id,category_id,amount,expense_date,description,status,requested_by_profile_id,reviewed_at,review_comment,cashflow_transaction_id,created_at,branches(name,code),expense_categories(name)&order=created_at.desc&limit=150",
      token
    ),
    restSelect<any>(
      "expense_attachments",
      "select=id,expense_request_id,storage_path,file_name,mime_type,size_bytes,created_at&order=created_at.asc&limit=300",
      token
    ),
  ]);

  const requesterIds = Array.from(new Set(requestRows.map((row: any) => row.requested_by_profile_id).filter(Boolean)));
  const requesterRows = requesterIds.length
    ? await restSelect<any>(
        "users_profile",
        `select=id,full_name,staff_display_name&id=in.(${requesterIds.map((id) => encodeURIComponent(id)).join(",")})`,
        token
      )
    : [];
  const requesterNameById = new Map(
    requesterRows.map((row: any) => [row.id, row.staff_display_name || row.full_name || "Сотрудник"])
  );

  const attachmentsByRequest = new Map<string, ExpenseAttachment[]>();
  attachmentRows.forEach((row: any) => {
    const item: ExpenseAttachment = {
      id: row.id,
      expenseRequestId: row.expense_request_id,
      storagePath: row.storage_path || "",
      fileName: row.file_name || "Чек",
      mimeType: row.mime_type || "",
      sizeBytes: safeNumber(row.size_bytes),
      createdAt: row.created_at || "",
    };
    const current = attachmentsByRequest.get(item.expenseRequestId) || [];
    current.push(item);
    attachmentsByRequest.set(item.expenseRequestId, current);
  });

  const branches: BusinessBranch[] = branchRows.map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: Boolean(row.is_active),
  }));
  const categories: ExpenseCategory[] = categoryRows.map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    categoryType: row.category_type,
  }));
  const requests: ExpenseRequest[] = requestRows.map((row: any) => ({
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branches?.name || "",
    branchCode: row.branches?.code || "",
    categoryId: row.category_id,
    categoryName: row.expense_categories?.name || "",
    amount: safeNumber(row.amount),
    expenseDate: row.expense_date || "",
    description: row.description || "",
    status: row.status as ExpenseStatus,
    requestedByProfileId: row.requested_by_profile_id || "",
    requesterName: requesterNameById.get(row.requested_by_profile_id) || "Сотрудник",
    reviewedAt: row.reviewed_at || "",
    reviewComment: row.review_comment || "",
    cashflowTransactionId: row.cashflow_transaction_id || "",
    createdAt: row.created_at || "",
    attachments: attachmentsByRequest.get(row.id) || [],
  }));

  let accounts: CashAccount[] = [];
  let cashflow: CashflowTransaction[] = [];
  if (identity.role === "owner") {
    const [accountRows, cashflowRows] = await Promise.all([
      restSelect<any>(
        "cash_accounts",
        "select=id,name,account_type,branch_id,opening_balance&is_active=eq.true&order=name.asc",
        token
      ),
      restSelect<any>(
        "cashflow_transactions",
        "select=id,transaction_date,direction,amount,description,source_type,source_id,created_at,branches(name),expense_categories(name),cash_accounts(name)&order=transaction_date.desc,created_at.desc&limit=150",
        token
      ),
    ]);
    accounts = accountRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      accountType: row.account_type,
      branchId: row.branch_id || "",
      openingBalance: safeNumber(row.opening_balance),
    }));
    cashflow = cashflowRows.map((row: any) => ({
      id: row.id,
      transactionDate: row.transaction_date || "",
      direction: row.direction,
      amount: safeNumber(row.amount),
      description: row.description || "",
      branchName: row.branches?.name || "",
      categoryName: row.expense_categories?.name || "",
      accountName: row.cash_accounts?.name || "",
      sourceType: row.source_type || "",
      sourceId: row.source_id || "",
      createdAt: row.created_at || "",
    }));
  }

  return {
    role: identity.role,
    staffBranch: profileRows[0]?.staff_branch || "",
    branches,
    categories,
    requests,
    accounts,
    cashflow,
  };
}

export async function submitExpense(input: {
  branchId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description: string;
}) {
  return rpc<string>("staff_submit_expense", {
    p_branch_id: input.branchId || null,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_expense_date: input.expenseDate,
    p_description: input.description.trim() || null,
  });
}

function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  return `${crypto.randomUUID()}${extension}`;
}

function encodedStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadExpenseReceipt(expense: { id: string; branchCode: string }, file: File) {
  if (!expense.id || !expense.branchCode) throw new Error("Не удалось определить путь для чека.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Чек должен быть меньше 10 МБ.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("Можно загрузить JPG, PNG, WEBP или PDF.");

  const token = await sessionToken();
  const storagePath = `${expense.branchCode}/${expense.id}/${safeFileName(file.name)}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${RECEIPT_BUCKET}/${encodedStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: headers(token, {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      }),
      body: file,
    }
  );
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.message || payload?.error || "";
    } catch {
      // ignore
    }
    throw new Error(detail || "Не удалось загрузить чек.");
  }

  await rpc<string>("staff_attach_expense_receipt", {
    p_expense_request_id: expense.id,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_mime_type: file.type || null,
    p_size_bytes: file.size,
  });

  return storagePath;
}

export async function attachReceiptToExpense(expense: ExpenseRequest, file: File) {
  return uploadExpenseReceipt({ id: expense.id, branchCode: expense.branchCode }, file);
}

export async function openExpenseReceipt(attachment: ExpenseAttachment) {
  const token = await sessionToken();
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${RECEIPT_BUCKET}/${encodedStoragePath(attachment.storagePath)}`,
    { headers: headers(token) }
  );
  if (!response.ok) throw new Error("Не удалось открыть чек.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function approveExpense(expenseRequestId: string, accountId: string, comment: string) {
  return rpc<string>("owner_approve_expense_request", {
    p_expense_request_id: expenseRequestId,
    p_account_id: accountId || null,
    p_comment: comment.trim() || null,
  });
}

export async function rejectExpense(expenseRequestId: string, comment: string) {
  return rpc<string>("owner_reject_expense_request", {
    p_expense_request_id: expenseRequestId,
    p_comment: comment.trim() || null,
  });
}

export async function cancelExpense(expenseRequestId: string, comment = "") {
  return rpc<string>("staff_cancel_expense_request", {
    p_expense_request_id: expenseRequestId,
    p_comment: comment.trim() || null,
  });
}
