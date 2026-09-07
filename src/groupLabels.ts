/** Display names for the two existing NLO Sunday 11:00 cohorts; identifiers stay stable. */
export function groupLabel(group: string, branch = "", day = "", time = ""): string {
  const sunday = day === "Воскресенье" || (/^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(day + "T12:00:00Z").getUTCDay() === 0);
  if (branch === "НЛО" && sunday && time.slice(0, 5) === "11:00") {
    if (group === "Базовый") return "База 1";
    if (group === "Продвинутый") return "База 2";
  }
  return group;
}
