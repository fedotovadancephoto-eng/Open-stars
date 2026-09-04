import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Layers3, LoaderCircle } from "lucide-react";

import { fetchPaymentContext, PaymentChild } from "@/admin/paymentApi";
import { bulkSetMonthlyCharge } from "@/admin/monthlyChargeApi";

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function numericInput(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

export function AdminBulkChargeSettings() {
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [children, setChildren] = useState<PaymentChild[]>([]);
  const [branch, setBranch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const context = await fetchPaymentContext();
        if (cancelled) return;
        setRole(context.role);
        setStaffBranch(context.staffBranch);
        setChildren(context.children);
        const firstBranch = context.role === "admin"
          ? context.staffBranch
          : Array.from(new Set(context.children.map((item) => item.branch).filter(Boolean))).sort()[0] || "";
        setBranch(firstBranch);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось загрузить группы.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const branches = useMemo(
    () => Array.from(new Set(children.map((item) => item.branch).filter(Boolean))).sort(),
    [children]
  );
  const groups = useMemo(
    () => Array.from(new Set(children.filter((item) => item.branch === branch).map((item) => item.groupName).filter(Boolean))).sort(),
    [children, branch]
  );
  const groupStudents = useMemo(
    () => children.filter((item) => item.branch === branch && item.groupName === groupName).length,
    [children, branch, groupName]
  );

  function changeBranch(value: string) {
    setBranch(value);
    setGroupName("");
    setError("");
    setSuccess("");
  }

  async function save() {
    const numericAmount = numericInput(amount);
    if (!branch) return setError("Выберите филиал.");
    if (!groupName) return setError("Выберите группу.");
    if (!Number.isFinite(numericAmount) || numericAmount < 0) return setError("Введите корректную сумму начисления. Можно указать 0 ₽.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await bulkSetMonthlyCharge({
        month,
        branch,
        groupName,
        expectedAmount: numericAmount,
        dueDate,
        note,
      });
      setSuccess(`Начисление сохранено для ${result.updatedStudents} учеников группы «${result.groupName}».`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить массовое начисление.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mt-5 flex items-center gap-2 rounded-[20px] bg-white p-4 text-xs text-black/40"><LoaderCircle className="animate-spin" size={15}/> Загружаю группы для начислений…</div>;
  }

  if (groups.length === 0 && branch) {
    return (
      <section className="mt-5 rounded-[20px] border border-black/[0.06] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3"><Layers3 size={18} className="mt-0.5 text-[#5F6338]"/><div><h3 className="text-sm font-semibold">Массовое начисление по группе</h3><p className="mt-1 text-xs leading-5 text-black/40">В выбранном филиале пока нет учеников с заполненным названием группы. Индивидуальные начисления доступны в карточке ребёнка.</p></div></div>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[20px] border border-[#5F6338]/15 bg-[#5F6338]/[0.035] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white text-[#4D512E]"><Layers3 size={18}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#4D512E]">Начисления</p>
          <h3 className="mt-1 text-base font-semibold text-[#171717]">Выставить сумму всей группе</h3>
          <p className="mt-1 text-xs leading-5 text-black/40">Укажите типовую сумму один раз. После этого исключения — скидку, перерасчёт или два направления — можно изменить индивидуально у ребёнка.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-semibold text-black/55">Филиал
          <select className={inputClass} value={branch} disabled={role === "admin"} onChange={(event) => changeBranch(event.target.value)}>
            {role !== "admin" && <option value="">Выберите филиал</option>}
            {(role === "admin" && staffBranch ? [staffBranch] : branches).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-black/55">Группа
          <select className={inputClass} value={groupName} onChange={(event) => setGroupName(event.target.value)}>
            <option value="">Выберите группу</option>
            {groups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-black/55">Месяц
          <input type="month" className={inputClass} value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="text-xs font-semibold text-black/55">Начислено на ребёнка, ₽
          <input inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например, 6000" />
        </label>
        <label className="text-xs font-semibold text-black/55">Оплатить до
          <input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="text-xs font-semibold text-black/55">Комментарий
          <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" />
        </label>
      </div>

      {groupName && <div className="mt-3 rounded-[13px] bg-white px-3.5 py-2.5 text-xs text-black/50">Будет обновлено учеников: <strong className="text-[#171717]">{groupStudents}</strong>. Существующие начисления этой группы за месяц будут заменены новой суммой, фактические оплаты не изменятся.</div>}

      <button type="button" onClick={() => void save()} disabled={saving || !groupName} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45">
        {saving ? <LoaderCircle className="animate-spin" size={16}/> : <Banknote size={16}/>} Начислить группе
      </button>

      {error && <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}
      {success && <div className="mt-3 flex items-start gap-2 rounded-[13px] bg-white px-3.5 py-2.5 text-xs leading-5 text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={14}/><span>{success} Закройте и снова откройте «Оплата», чтобы увидеть обновлённый свод.</span></div>}
    </section>
  );
}
