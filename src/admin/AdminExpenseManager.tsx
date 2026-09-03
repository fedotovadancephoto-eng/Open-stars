import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileText, LoaderCircle, Paperclip, Plus, ReceiptText, Upload, X } from "lucide-react";

import { onAdminSection } from "@/admin/adminNavigation";
import {
  ExpenseRequest,
  fetchBusinessExpenseContext,
  openExpenseReceipt,
  submitExpense,
  uploadExpenseReceipt,
  attachReceiptToExpense,
  BusinessExpenseContext,
} from "@/admin/businessApi";

const inputClass =
  "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

const statusLabel: Record<string, string> = {
  submitted: "На подтверждении",
  approved: "Подтверждён",
  rejected: "Отклонён",
  cancelled: "Отменён",
  draft: "Черновик",
};

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function shortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(".", "");
}

export function AdminExpenseManager() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<BusinessExpenseContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    const next = await fetchBusinessExpenseContext();
    setContext(next);
    if (next.role === "admin") {
      const branch = next.branches.find((item) => item.name === next.staffBranch);
      setBranchId(branch?.id || "");
    } else if (!branchId && next.branches.length === 1) {
      setBranchId(next.branches[0].id);
    }
    if (!categoryId && next.categories.length) setCategoryId(next.categories[0].id);
    return next;
  }

  useEffect(() =>
    onAdminSection("expenses", () => {
      setOpen(true);
      setError("");
      setSuccess("");
      setLoading(true);
      void refresh()
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть расходы."))
        .finally(() => setLoading(false));
    }), []);

  const myBranchLocked = context?.role === "admin";
  const recent = useMemo(() => context?.requests.slice(0, 40) || [], [context]);

  async function createExpense() {
    const numericAmount = Number(amount.replace(",", "."));
    if (!branchId) return setError("Выберите филиал.");
    if (!categoryId) return setError("Выберите категорию.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите сумму больше нуля.");

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const expenseId = await submitExpense({
        branchId,
        categoryId,
        amount: numericAmount,
        expenseDate,
        description,
      });
      const branch = context?.branches.find((item) => item.id === branchId);
      let receiptWarning = "";
      if (receipt && branch) {
        try {
          await uploadExpenseReceipt({ id: expenseId, branchCode: branch.code }, receipt);
        } catch (reason) {
          receiptWarning = reason instanceof Error ? ` Расход отправлен, но чек не загрузился: ${reason.message}` : " Расход отправлен, но чек не загрузился.";
        }
      }
      await refresh();
      setAmount("");
      setDescription("");
      setReceipt(null);
      if (fileRef.current) fileRef.current.value = "";
      setSuccess(`Расход отправлен владельцу.${receiptWarning}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить расход.");
    } finally {
      setSaving(false);
    }
  }

  async function retryReceipt(expense: ExpenseRequest, file: File) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await attachReceiptToExpense(expense, file);
      await refresh();
      setSuccess("Чек прикреплён к расходу.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось прикрепить чек.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[30px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[30px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS BUSINESS</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">Расходы филиала</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Сотрудник фиксирует расход один раз. После подтверждения владельцем он автоматически становится операцией ДДС.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="grid min-h-[360px] place-items-center"><LoaderCircle className="animate-spin text-black/25" size={28} /></div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
            <section className="rounded-[26px] border border-black/[0.06] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#D96A24]/10 text-[#C95320]"><Plus size={20} /></span><div><h3 className="font-semibold">Добавить расход</h3><p className="mt-0.5 text-xs text-black/40">Обычно занимает меньше минуты</p></div></div>

              <div className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-black/55">Филиал
                  <select className={inputClass} value={branchId} disabled={myBranchLocked} onChange={(event) => setBranchId(event.target.value)}>
                    <option value="">Выберите филиал</option>
                    {context?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-black/55">Категория
                  <select className={inputClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Выберите категорию</option>
                    {context?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-black/55">Сумма, ₽
                    <input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="3500" />
                  </label>
                  <label className="block text-xs font-semibold text-black/55">Дата расхода
                    <input className={inputClass} type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-black/55">Комментарий
                  <textarea className={`${inputClass} min-h-[96px] resize-none`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Например: канцтовары для филиала" />
                </label>

                <label className="block text-xs font-semibold text-black/55">Чек или подтверждающий файл
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => setReceipt(event.target.files?.[0] || null)} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-black/[0.14] bg-[#FAF9F5] px-4 py-4 text-sm font-semibold text-black/65">
                    {receipt ? <><Paperclip size={17} />{receipt.name}</> : <><Upload size={17} />Прикрепить чек</>}
                  </button>
                  <span className="mt-2 block text-[11px] leading-4 text-black/35">JPG, PNG, WEBP или PDF · до 10 МБ</span>
                </label>

                <button type="button" disabled={saving} onClick={createExpense} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                  {saving ? <LoaderCircle className="animate-spin" size={18} /> : <ReceiptText size={18} />} Отправить владельцу
                </button>
              </div>
            </section>

            <section className="rounded-[26px] border border-black/[0.06] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Последние расходы</h3><p className="mt-1 text-xs text-black/40">Видимость зависит от вашей роли и филиала</p></div><span className="rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-black/50">{recent.length}</span></div>
              {recent.length === 0 ? (
                <div className="grid min-h-[260px] place-items-center text-center text-sm text-black/35">Расходов пока нет.</div>
              ) : (
                <div className="mt-4 max-h-[610px] space-y-3 overflow-y-auto pr-1">
                  {recent.map((expense) => (
                    <article key={expense.id} className="rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{expense.categoryName}</p><p className="mt-1 text-xs text-black/40">{expense.branchName} · {shortDate(expense.expenseDate)} · {expense.requesterName}</p></div><p className="shrink-0 text-lg font-semibold tracking-[-0.03em]">{money(expense.amount)}</p></div>
                      {expense.description && <p className="mt-3 text-sm leading-5 text-black/60">{expense.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${expense.status === "approved" ? "bg-[#5F6338]/10 text-[#4D512E]" : expense.status === "rejected" ? "bg-red-50 text-red-600" : expense.status === "submitted" ? "bg-[#D96A24]/10 text-[#C95320]" : "bg-black/[0.05] text-black/50"}`}>{statusLabel[expense.status] || expense.status}</span>
                        {expense.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void openExpenseReceipt(attachment).catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть чек."))} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/60"><FileText size={13} />Чек</button>)}
                        {expense.status === "submitted" && expense.attachments.length === 0 && (
                          <label className="cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#C95320]">+ Добавить чек<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void retryReceipt(expense, file); event.currentTarget.value = ""; }} /></label>
                        )}
                      </div>
                      {expense.status === "approved" && <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#4D512E]"><CheckCircle2 size={15} />Операция уже попала в ДДС</div>}
                      {expense.reviewComment && <p className="mt-3 rounded-[12px] bg-white px-3 py-2 text-xs leading-5 text-black/50">Комментарий владельца: {expense.reviewComment}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {error && <div className="mt-5 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-5 flex gap-2 rounded-[16px] bg-[#5F6338]/[0.08] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={17} />{success}</div>}
      </div>
    </div>
  );
}
