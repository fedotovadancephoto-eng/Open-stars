export const branchAdministrators: Record<string, string> = {
  "НЛО": "Белова Марина",
  "Свердловский": "Додарчук Светлана",
  "Октябрьский": "Маргарита Семидельская",
};

export function administratorForBranch(branch: string) {
  return branchAdministrators[branch] || "";
}
