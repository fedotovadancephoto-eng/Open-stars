# Revenue and DDS refund semantics

For OPEN STARS financial reporting:

- Gross income keeps the original incoming payment for audit history.
- A real refund creates a separate outgoing cashflow transaction.
- Displayed branch revenue is gross income minus refund transactions.
- DDS expenses include the refund outflow.
- Net DDS is gross income minus all outgoing cashflow, so a refund lowers net DDS exactly once.

This prevents deleting historical income while keeping current branch revenue and cash balances correct.
