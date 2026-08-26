import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
} from "lucide-react";

import { Card } from "@/components/Card";

const paymentHistory = [
  {
    id: "payment-1",
    month: "Сентябрь 2026",
    dueDate: "до 10 сентября 2026",
    status: "upcoming",
  },
  {
    id: "payment-2",
    month: "Август 2026",
    dueDate: "10 августа 2026",
    status: "paid",
  },
  {
    id: "payment-3",
    month: "Июль 2026",
    dueDate: "10 июля 2026",
    status: "paid",
  },
];

export function PaymentsTab() {
  const currentPayment =
    paymentHistory[0];

  const previousPayments =
    paymentHistory.slice(1);

  return (
    <div className="space-y-5">
      {/* Заголовок */}
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
              Здесь отображается актуальный статус оплаты обучения
              и информация за предыдущие месяцы.
            </p>
          </div>

          <div
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-black/[0.07]
              bg-white
              px-3.5
              py-2
              text-xs
              font-semibold
              text-black/55
            "
          >
            <History
              className="h-4 w-4 text-[#5F6338]"
              strokeWidth={2}
            />

            История оплаты
          </div>
        </div>
      </Card>

      {/* Текущий месяц */}
      <Card className="overflow-hidden p-0" hover={false}>
        <div className="relative p-5 sm:p-6">
          <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#D96A24]" />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
                Текущий месяц
              </p>

              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
                {currentPayment.month}
              </h3>

              <div className="mt-3 flex items-center gap-2 text-sm text-black/45">
                <CalendarDays
                  className="h-4 w-4"
                  strokeWidth={1.8}
                />

                Оплата {currentPayment.dueDate}
              </div>
            </div>

            <div
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                bg-[#D96A24]/10
                px-3.5
                py-2
                text-sm
                font-semibold
                text-[#C95320]
              "
            >
              <Clock3
                className="h-4 w-4"
                strokeWidth={2}
              />

              Ожидаем оплату
            </div>
          </div>
        </div>
      </Card>

      {/* Предыдущие месяцы */}
      <div>
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
          Предыдущие месяцы
        </p>

        <div className="mt-3 space-y-3">
          {previousPayments.map(
            (payment) => (
              <Card
                key={payment.id}
                className="p-4 sm:p-5"
                hover={false}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                      {payment.month}
                    </h3>

                    <div className="mt-2 flex items-center gap-2 text-xs text-black/35">
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        strokeWidth={1.8}
                      />

                      {payment.dueDate}
                    </div>
                  </div>

                  <div
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-full
                      bg-[#5F6338]/10
                      px-3
                      py-1.5
                      text-xs
                      font-semibold
                      text-[#4D512E]
                    "
                  >
                    <CheckCircle2
                      className="h-4 w-4"
                      strokeWidth={2}
                    />

                    Оплачено
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      </div>

      {/* Информация */}
      <div
        className="
          flex
          items-start
          gap-3
          rounded-[20px]
          border
          border-black/[0.06]
          bg-white
          px-4
          py-4
        "
      >
        <CreditCard
          className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]"
          strokeWidth={2}
        />

        <p className="text-xs leading-relaxed text-black/45">
          Оплата обучения производится до 10 числа каждого месяца.
          После подтверждения оплаты статус обновляется в личном кабинете.
        </p>
      </div>
    </div>
  );
}