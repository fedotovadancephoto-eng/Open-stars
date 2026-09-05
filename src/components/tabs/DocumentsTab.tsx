import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, FileCheck2, FileText, LoaderCircle, PenLine, ShieldCheck, X } from "lucide-react";

import { Card } from "@/components/Card";
import { child } from "@/data/demoData";
import {
  fetchParentDocumentCenter,
  ParentDocumentCenter,
  ParentDocumentItem,
  saveParentDocumentDetails,
  signParentDocument,
} from "@/documentApi";

const inputClass = "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusMeta(item: ParentDocumentItem) {
  if (item.status === "accept") return { label: "Подписано", className: "bg-[#5F6338]/10 text-[#4D512E]" };
  if (item.status === "decline") return { label: "Не согласовано", className: "bg-black/[0.055] text-black/55" };
  if (item.status === "revoke") return { label: "Согласие отозвано", className: "bg-amber-50 text-amber-700" };
  if (!item.body && item.code === "education_contract") return { label: "Готовит администратор", className: "bg-[#D96A24]/10 text-[#C95320]" };
  return { label: item.required ? "Нужно подписать" : "Ваш выбор", className: "bg-[#D96A24]/10 text-[#C95320]" };
}

function DocumentModal({
  item,
  esignAccepted,
  detailsReady,
  saving,
  onClose,
  onDecision,
}: {
  item: ParentDocumentItem;
  esignAccepted: boolean;
  detailsReady: boolean;
  saving: boolean;
  onClose: () => void;
  onDecision: (decision: "accept" | "decline" | "revoke") => void;
}) {
  const [checked, setChecked] = useState(false);
  const accepted = item.status === "accept";
  const canAccept = Boolean(item.body) && checked && (item.code === "esign_agreement" || esignAccepted) && (item.code === "esign_agreement" || item.code === "photo_video" || detailsReady);

  useEffect(() => setChecked(false), [item.code, item.version]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] bg-[#FAF9F5] shadow-2xl sm:max-h-[88vh] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · ДОКУМЕНТ</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#171717]">{item.title}</h3>
            {item.signedAt && <p className="mt-1 text-xs text-black/40">Последнее действие: {formatDate(item.signedAt)}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[0.055] text-black/60"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {item.body ? (
            <div className="whitespace-pre-wrap rounded-[20px] border border-black/[0.06] bg-white p-5 text-[13px] leading-6 text-black/75 sm:p-6 sm:text-sm">{item.body}</div>
          ) : (
            <div className="rounded-[20px] border border-[#D96A24]/15 bg-[#D96A24]/[0.055] p-5 text-sm leading-6 text-[#6F4A32]">
              Администратору нужно указать индивидуальную стоимость и срок обучения. После этого договор появится здесь автоматически.
            </div>
          )}

          {!accepted && item.body && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[18px] border border-black/[0.06] bg-white p-4">
              <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#D96A24]" />
              <span className="text-sm leading-6 text-[#171717]">
                {item.code === "photo_video"
                  ? "Я ознакомился(ась) с документом и подтверждаю выбранное ниже решение."
                  : "Я ознакомился(ась) с полным текстом документа и согласен(на) с ним."}
              </span>
            </label>
          )}

          {!esignAccepted && item.code !== "esign_agreement" && item.status !== "accept" && (
            <p className="mt-3 text-xs leading-5 text-[#C95320]">Сначала подпишите документ «Электронное подписание».</p>
          )}
          {!detailsReady && ["personal_data", "education_contract"].includes(item.code) && item.status !== "accept" && (
            <p className="mt-3 text-xs leading-5 text-[#C95320]">Перед подписанием заполните адрес родителя и адрес ребёнка в карточке «Данные для документов».</p>
          )}
          {item.hash && <p className="mt-4 break-all text-[10px] leading-4 text-black/30">Контрольная сумма подписанной версии: {item.hash}</p>}
        </div>

        <div className="border-t border-black/[0.06] bg-white p-4 sm:px-6">
          {accepted ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#4D512E]"><CheckCircle2 className="h-5 w-5" /> Документ подписан</div>
              {["personal_data", "photo_video"].includes(item.code) && (
                <button type="button" disabled={saving} onClick={() => onDecision("revoke")} className="rounded-[14px] border border-black/[0.08] px-4 py-2.5 text-xs font-semibold text-black/55 disabled:opacity-50">Отозвать согласие</button>
              )}
            </div>
          ) : item.code === "photo_video" ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!canAccept || saving} onClick={() => onDecision("accept")} className="rounded-[15px] bg-[#5F6338] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-35">Согласен(на)</button>
              <button type="button" disabled={!item.body || !checked || !esignAccepted || saving} onClick={() => onDecision("decline")} className="rounded-[15px] border border-black/[0.08] bg-white px-4 py-3.5 text-sm font-semibold text-[#171717] disabled:opacity-35">Не согласен(на)</button>
            </div>
          ) : (
            <button type="button" disabled={!canAccept || saving} onClick={() => onDecision("accept")} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white disabled:opacity-35">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Подписать документ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentsTab() {
  const [center, setCenter] = useState<ParentDocumentCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeDocument, setActiveDocument] = useState<ParentDocumentItem | null>(null);
  const [parentAddress, setParentAddress] = useState("");
  const [childAddress, setChildAddress] = useState("");
  const [email, setEmail] = useState("");
  const [sameAddress, setSameAddress] = useState(false);

  async function load() {
    const next = await fetchParentDocumentCenter(child.id);
    setCenter(next);
    setParentAddress(next.profile.address || "");
    setChildAddress(next.child.address || "");
    setEmail(next.profile.email || "");
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось загрузить документы.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [child.id]);

  const esignAccepted = useMemo(() => center?.documents.some((item) => item.code === "esign_agreement" && item.status === "accept") || false, [center]);
  const detailsReady = parentAddress.trim().length >= 5 && childAddress.trim().length >= 5;
  const signedRequired = center?.documents.filter((item) => item.required && item.status === "accept").length || 0;
  const requiredCount = center?.documents.filter((item) => item.required).length || 0;

  async function saveDetails() {
    setSaving(true); setError(""); setSuccess("");
    try {
      await saveParentDocumentDetails({ childId: child.id, parentAddress, childAddress: sameAddress ? parentAddress : childAddress, email });
      await load();
      setSuccess("Данные для документов сохранены.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить данные.");
    } finally { setSaving(false); }
  }

  async function decide(item: ParentDocumentItem, decision: "accept" | "decline" | "revoke") {
    setSaving(true); setError(""); setSuccess("");
    try {
      await signParentDocument(child.id, item.code, decision);
      const next = await load();
      const refreshed = next.documents.find((doc) => doc.code === item.code) || null;
      setActiveDocument(refreshed);
      setSuccess(decision === "accept" ? "Документ подписан." : decision === "decline" ? "Ваш отказ сохранён." : "Отзыв согласия сохранён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить решение.");
    } finally { setSaving(false); }
  }

  if (loading) return <Card className="p-6" hover={false}><div className="flex items-center gap-3 text-sm text-black/50"><LoaderCircle className="h-5 w-5 animate-spin" /> Загружаем документы…</div></Card>;
  if (!center) return <Card className="p-6" hover={false}><p className="font-semibold text-[#171717]">Документы пока недоступны</p><p className="mt-2 text-sm text-red-600">{error}</p></Card>;

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-[#D96A24]">Документы</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Без бумаги и печати</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Откройте каждый документ, прочитайте его и подтвердите отдельной галочкой. SMS-код при каждом подписании не требуется — используется ваш авторизованный аккаунт.</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#D96A24]/10 text-[#C95320]"><FileCheck2 className="h-5 w-5" /></div>
        </div>
        <div className="mt-5 rounded-[16px] bg-[#5F6338]/[0.08] px-4 py-3 text-sm font-medium text-[#4D512E]">Обязательные документы: {signedRequired} из {requiredCount} подписано</div>
      </Card>

      {(error || success) && <div className={`rounded-[16px] px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-[#5F6338]/[0.08] text-[#4D512E]"}`}>{error || success}</div>}

      <Card className="p-5 sm:p-6" hover={false}>
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-black/[0.055]"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#171717]">Данные для документов</h3><p className="mt-1 text-sm leading-6 text-black/45">Адрес нужен для договора. Он не показывается другим родителям.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-black/55">Ваш адрес проживания<input value={parentAddress} onChange={(e) => { setParentAddress(e.target.value); if (sameAddress) setChildAddress(e.target.value); }} className={inputClass} placeholder="Иркутск, улица, дом, квартира" /></label>
          <label className="text-xs font-semibold text-black/55">E-mail (необязательно)<input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@example.ru" inputMode="email" /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-black/55"><input type="checkbox" checked={sameAddress} onChange={(e) => { setSameAddress(e.target.checked); if (e.target.checked) setChildAddress(parentAddress); }} className="h-4 w-4 accent-[#D96A24]" /> Адрес ребёнка совпадает с моим</label>
        {!sameAddress && <label className="mt-3 block text-xs font-semibold text-black/55">Адрес ребёнка<input value={childAddress} onChange={(e) => setChildAddress(e.target.value)} className={inputClass} placeholder="Иркутск, улица, дом, квартира" /></label>}
        <button type="button" disabled={saving || !detailsReady} onClick={() => void saveDetails()} className="mt-4 rounded-[14px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white disabled:opacity-35">{saving ? "Сохраняем…" : "Сохранить данные"}</button>
      </Card>

      <div className="space-y-3">
        {center.documents.map((item) => {
          const meta = statusMeta(item);
          return (
            <button key={item.code} type="button" onClick={() => setActiveDocument(item)} className="flex w-full items-center gap-4 rounded-[20px] border border-black/[0.055] bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.025)] transition active:scale-[0.995] sm:p-5">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ${item.status === "accept" ? "bg-[#5F6338]/10 text-[#4D512E]" : "bg-[#D96A24]/10 text-[#C95320]"}`}><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#171717]">{item.shortTitle}</p>{item.required && <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/30">обязательно</span>}</div><p className="mt-1 text-xs text-black/40">Версия {item.version}{item.signedAt ? ` · ${formatDate(item.signedAt)}` : ""}</p></div>
              <div className="flex shrink-0 items-center gap-2"><span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${meta.className}`}>{meta.label}</span><ChevronRight className="h-5 w-5 text-black/25" /></div>
            </button>
          );
        })}
      </div>

      {activeDocument && <DocumentModal item={activeDocument} esignAccepted={esignAccepted} detailsReady={detailsReady} saving={saving} onClose={() => setActiveDocument(null)} onDecision={(decision) => void decide(activeDocument, decision)} />}
    </div>
  );
}
