# Tuition refund flow

A real refund is different from correcting an erroneous payment entry.

1. The original payment receipt remains in history.
2. The receipt is marked as refunded.
3. It is excluded from collected tuition totals.
4. A separate `tuition_refund` expense is added to cashflow for the same branch.
5. Branch revenue decreases by the refunded amount.
6. DDS expenses increase by the refunded amount and net cashflow decreases by the same amount.
7. After the refund is complete, the student can be moved to `Выбывшие` without deleting financial history.

The owner-only UI action is `Возврат оплаты`. Admin payment correction remains a separate workflow.
