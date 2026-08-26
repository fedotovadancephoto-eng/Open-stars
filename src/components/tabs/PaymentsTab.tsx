import { CalendarDays, CheckCircle2, Clock3, CreditCard } from "lucide-react";

import { Card } from "@/components/Card";
import { payments } from "@/data/demoData";

export function PaymentsTab() {
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Оплата обучения
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Оплата
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">
              Актуальные статусы оплаты из системы OPEN STARS.
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#5F6338]/10 text-[#4D512E]">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </Card>

      {payments.length === 0 ? (
        <Card className="p-6" hover={false}>
          <p className="font-semibold text-[#171717]">Данные об оплате пока не добавлены</p>
          <p className="mt-1 text-sm leading-6 text-black/45">
            После внесения информации администрацией школы статус появится здесь.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment: any) => {
            const paid = payment.status === "paid";

            return (
              <Card key={payment.id} className="p-5" hover={false}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                      {payment.month}
                    </h3>
                    {payment.dueDate && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-black/40">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Срок: {payment.dueDate}
                      </div>
                    )}
                    {Number(payment.amount || 0) > 0 && (
                      <p className="mt-2 text-sm font-semibold text-black/60">
                        {Number(payment.amount).toLocaleString("ru-RU")} ₽
                      </p>
                    )}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${
                      paid
                        ? "bg-[#5F6338]/10 text-[#4D512E]"
                        : "bg-[#D96A24]/10 text-[#C95320]"
                    }`}
                  >
                    {paid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}
                    {payment.statusLabel || (paid ? "Оплачено" : "Ожидает оплаты")}
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
