import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, KeyRound, LoaderCircle, Search, X } from "lucide-react";

import { AdminChild, StaffRole, fetchAdminChildren, fetchStaffIdentity, getValidStaffSession } from "@/admin/adminApi";
import { onAdminSection } from "@/admin/adminNavigation";
import { generateParentPasswordResetCode, ParentPasswordResetCode } from "@/admin/parentPasswordResetApi";

const branches = ["НЛО", "Свердловский", "Октябрьский"];

type ParentRow = {
  key: string;
  parentProfileId: string;
  parentName: string;
  parentPhone: string;
  branch: string;
  childId: string;
  children: string[];
  groups: string[];
};

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export function AdminParentPasswordResetManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [children, setChildren] = useState<AdminChild[]>([]);
  const [branch, setBranch] = useState("НЛО");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [codes, setCodes] = useState<Record<string, ParentPasswordResetCode>>({});
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const session = await getValidStaffSession();
    if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");
    const identity = await fetchStaffIdentity();
    if (identity.role === "teacher") throw new Error("Этот раздел недоступен педагогу.");

    setRole(identity.role);
    const rows = await fetchAdminChildren(identity.role);
    setChildren(rows.filter((item) => !item.archivedAt));

    const available = Array.from(new Set(rows.map((item) => item.branch).filter(Boolean)));
    if (identity.role === "admin" && available[0]) setBranch(available[0]);
    else if (!available.includes(branch) && available[0]) setBranch(available[0]);
  }

  useEffect(() => onAdminSection("parent-password-reset", () => {
    setOpen(true);
    setLoading(true);
    setError("");
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить родителей."))
      .finally(() => setLoading(false));
  }), []);

  const availableBranches = useMemo(() => {
    const values = Array.from(new Set(children.map((item) => item.branch).filter(Boolean)));
    return values.length ? values : branches;
  }, [children]);

  const parents = useMemo<ParentRow[]>(() => {
    const map = new Map<string, ParentRow>();

    children
      .filter((item) => item.activationStatus === "active")
      .filter((item) => !branch || item.branch === branch)
      .forEach((child) => {
        const key = child.parentProfileId || child.familyId || child.id;
        const current = map.get(key);
        if (current) {
          if (!current.children.includes(child.fullName)) current.children.push(child.fullName);
          if (child.groupName && !current.groups.includes(child.groupName)) current.groups.push(child.groupName);
          return;
        }
        map.set(key, {
          key,
          parentProfileId: child.parentProfileId,
          parentName: child.parentName || "Родитель",
          parentPhone: child.parentPhone || "",
          branch: child.branch,
          childId: child.id,
          children: [child.fullName],
          groups: child.groupName ? [child.groupName] : [],
        });
      });

    const normalized = query.trim().toLowerCase();
    return Array.from(map.values())
      .filter((item) => !normalized || [item.parentName, item.parentPhone, item.children.join(" "), item.groups.join(" ")].join(" ").toLowerCase().includes(normalized))
      .sort((a, b) => a.parentName.localeCompare(b.parentName, "ru"));
  }, [children, branch, query]);

  async function issueCode(parent: ParentRow) {
    if (!window.confirm(`Выдать код восстановления пароля для ${parent.parentName}? Если код уже выдавался, предыдущий перестанет действовать.`)) return;

    setBusyKey(parent.key);
    setError("");
    try {
      const result = await generateParentPasswordResetCode(parent.childId);
      setCodes((current) => ({ ...current, [parent.key]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выдать код восстановления.");
    } finally {
      setBusyKey("");
    }
  }

  async function copyCode(parent: ParentRow, result: ParentPasswordResetCode) {
    await copyText(`${parent.parentName} · ${result.phone}\nКод восстановления OPEN STARS: ${result.resetCode}\nКод действует 60 минут.`);
    setCopied(parent.key);
    window.setTimeout(() => setCopied(""), 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !busyKey && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
            <h2 className="mt-1 text-2xl font-semibold">Восстановление пароля родителей</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Только для уже активированных кабинетов. Выдайте родителю одноразовый код, после чего он нажмёт «Забыли пароль?» и задаст новый пароль.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><X size={20} /></button>
        </div>

        <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1 text-xs font-semibold text-black/55">Филиал
              <select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={role === "admin"} className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none disabled:opacity-65">
                {availableBranches.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="flex-[1.4] text-xs font-semibold text-black/55">Поиск
              <div className="relative mt-1.5">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Родитель, ребёнок или телефон" className="w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none" />
              </div>
            </label>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2"><KeyRound size={18} className="text-[#D96A24]" /><h3 className="text-lg font-semibold">Активированные родители</h3></div>
          {loading ? <div className="grid min-h-[160px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div> : <div className="space-y-2">
            {parents.length === 0 && <div className="rounded-[16px] bg-[#FAF9F5] px-4 py-8 text-center text-sm text-black/40">Активированные родители не найдены.</div>}
            {parents.map((parent) => {
              const result = codes[parent.key];
              return <div key={parent.key} className="rounded-[16px] border border-black/[0.055] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{parent.parentName}</p>
                    <p className="mt-1 text-xs text-black/40">{parent.parentPhone || "телефон не указан"} · {parent.children.join(", ")}</p>
                    {parent.groups.length > 0 && <p className="mt-1 text-[11px] text-black/35">{parent.groups.join(" · ")}</p>}
                  </div>
                  <button type="button" disabled={busyKey === parent.key || !parent.parentPhone} onClick={() => issueCode(parent)} className="flex shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[#171717] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                    {busyKey === parent.key ? <LoaderCircle className="animate-spin" size={14} /> : <KeyRound size={14} />} Сбросить пароль
                  </button>
                </div>
                {result && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[13px] bg-[#F2F0E8] px-3.5 py-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-black/35">Код восстановления</p><p className="mt-0.5 text-xl font-bold tracking-[0.12em]">{result.resetCode}</p><p className="mt-1 text-[10px] text-black/35">Действует до {dateLabel(result.expiresAt)} · максимум 5 попыток</p></div>
                  <button type="button" onClick={() => copyCode(parent, result)} className="flex items-center gap-1.5 rounded-[11px] bg-white px-3 py-2 text-xs font-semibold">{copied === parent.key ? <Check size={14} /> : <Clipboard size={14} />} {copied === parent.key ? "Скопировано" : "Копировать сообщение"}</button>
                </div>}
              </div>;
            })}
          </div>}
        </section>

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </div>
  );
}
