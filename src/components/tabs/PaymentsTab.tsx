import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, ExternalLink } from "lucide-react";

import { Card } from "@/components/Card";
import { child, payments } from "@/data/demoData";
import { fetchParentPaymentLink } from "@/paymentLinkApi";

function monthLabel(value: string) {
  if (!value) return "Период оплаты";
  const normalized = /^\d{4}-\d{2}/.test(value) ? `${value.slice(0, 7)}-01T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const result = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function PaymentsTab() {
  const [paymentUrl, setPaymentUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchParentPaymentLink(child.branch).then((url) => {
      if (!cancelled) setPaymentUrl(url);
    }).catch(() => {
      if (!cancelled) setPaymentUrl("");
    });
    return () => { cancelled = true; };
  }, [child.id, child.branch]);

  const canPay = Boolean(paymentUrl) && child.paymentStatus !== "paid";

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">Оплата обучения</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Статус абонемента</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">Оплата открывается на защищённой странице банка или платёжного сервиса. После оплаты администратор OPEN STARS вручную подтверждает статус в кабинете.</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#5F6338]/10 text-[#4D512E]"><CreditCard className="h-5 w-5" /></div>
        </div>
        {canPay && (
          <a href={paymentUrl} target="_blank" rel="noreferrer" className="mt-5 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.10)] active:scale-[0.99]">
            <CreditCard className="h-4 w-4" /> Оплатить обучение <ExternalLink className="h-4 w-4 opacity-60" />
          </a>
        )}
        {paymentUrl && child.paymentStatus === "paid" && <div className="mt-5 flex items-center gap-2 rounded-[14px] bg-[#5F6338]/[0.08] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 className="h-4 w-4" /> Оплата отмечена администрацией.</div>}
      </Card>

      {payments.length === 0 ? (
        <Card className="p-6" hover={false}><p className="font-semibold text-[#171717]">Статус оплаты пока не добавлен</p><p className="mt-1 text-sm leading-6 text-black/45">После обновления статуса администрацией он появится здесь.</p></Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment: any) => {
            const paid = payment.status === "paid";
            const overdue = payment.status === "overdue";
            const label = paid ? "Оплачено" : overdue ? "Просрочено" : "Ожидает оплаты";
            return (
              <Card key={payment.id} className="p-5" hover={false}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Абонемент</p><h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#171717]">{monthLabel(payment.month)}</h3></div>
                  <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${paid ? "bg-[#5F6338]/10 text-[#4D512E]" : overdue ? "bg-red-50 text-red-600" : "bg-[#D96A24]/10 text-[#C95320]"}`}>
                    {paid ? <CheckCircle2 className="h-4 w-4" /> : overdue ? <AlertCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{label}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
