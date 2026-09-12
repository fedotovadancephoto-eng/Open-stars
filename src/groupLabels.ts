/** Display names for the split 11:00 cohorts; persisted group identifiers stay stable. */
export function groupLabel(group: string, branch = "", day = "", time = ""): string {
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(day + "T12:00:00Z").getUTCDay() : undefined;
  const sunday = day === "Воскресенье" || weekday === 0;
  const saturday = day === "Суббота" || weekday === 6;
  const splitCohort = (branch === "НЛО" && sunday) || (branch === "Октябрьский" && saturday);
  if (splitCohort && time.slice(0, 5) === "11:00") {
    if (group === "Базовый") return "База 1";
    if (group === "Продвинутый") return "База 2";
  }
  return group;
}
