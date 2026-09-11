import type { XlsxSheet } from "@/admin/xlsxExport";
import type { ReportFilters, RestRow } from "@/admin/reportExportShared";

type Child = {id:string;fullName:string;branch:string;groupName:string};
const methodLabels:Record<string,string> = {cash:"Наличные",online:"Онлайн · Точка",bank_transfer:"Перевод на счёт",other:"Другое"};
const channel = (method:string) => method === "cash" ? "cash" : ["online","bank_transfer","bank","card"].includes(method) ? "noncash" : "unknown";
function localDate(value:string) { const date=new Date(value);return Number.isNaN(date.getTime())?value.slice(0,10):new Date(date.getTime()+8*3600000).toISOString().slice(0,10); }

export function buildPaymentSheets(children:Child[],payments:RestRow[],receipts:RestRow[],charges:RestRow[],filters:ReportFilters):XlsxSheet[] {
 const childMap=new Map(children.map(c=>[c.id,c]));
 const paymentMap=new Map(payments.map(p=>[p.id,p]));
 const months=new Map<string,RestRow>();
 const key=(id:string,month:string)=>`${id}:${month.slice(0,7)}`;
 const ensure=(id:string,month:string)=>{
  const k=key(id,month);let row=months.get(k);
  if(!row){const child=childMap.get(id)!;row={month:month.slice(0,7),child:child.fullName,branch:child.branch,group:child.groupName,expected:null,received:0,refunded:0,cash:0,noncash:0,unknown:0,dueDate:"",legacy:null};months.set(k,row);}
  return row;
 };
 for(const p of payments)if(childMap.has(p.child_id)) { const row=ensure(p.child_id,p.month);row.dueDate=p.due_date||"";row.legacy=p.amount==null?null:Number(p.amount); }
 for(const c of charges)if(childMap.has(c.child_id)) { const row=ensure(c.child_id,c.month);row.expected=c.expected_amount==null?null:Number(c.expected_amount);row.dueDate=c.due_date||row.dueDate; }
 const details:RestRow[]=[];
 for(const r of receipts){
  if(!childMap.has(r.child_id)||r.voided_at)continue;
  const p=paymentMap.get(r.payment_id);const child=childMap.get(r.child_id)!;
  const amount=Number(r.amount);const date=localDate(r.received_at);
  if(p){const row=ensure(r.child_id,p.month);if(r.refunded_at)row.refunded+=amount;else {row.received+=amount;row[channel(r.payment_method)]+=amount;}}
  if((!filters.fromDate||date>=filters.fromDate)&&(!filters.toDate||date<=filters.toDate))details.push({date,month:p?.month?.slice(0,7)||"",child:child.fullName,branch:r.branches?.name||child.branch,amount,method:methodLabels[r.payment_method]||r.payment_method||"Не указан",status:r.refunded_at?"Возврат произведён":"Получено",refundDate:r.refunded_at?localDate(r.refunded_at):"",note:r.note||"",refundReason:r.refund_reason||""});
 }
 const rows=[...months.values()].filter(r=>(!filters.fromDate||r.month>=filters.fromDate.slice(0,7))&&(!filters.toDate||r.month<=filters.toDate.slice(0,7))).sort((a,b)=>a.month.localeCompare(b.month)||a.child.localeCompare(b.child)).map(r=>({...r,remaining:r.expected==null?null:Math.max(0,r.expected-r.received),overpaid:r.expected==null?null:Math.max(0,r.received-r.expected)}));
 return [{name:"Оплата",columns:[
  {key:"month",label:"Месяц занятий"},{key:"child",label:"Ученик",width:28},{key:"branch",label:"Округ",width:20},{key:"group",label:"Группа"},
  {key:"expected",label:"Начислено, ₽",width:18},{key:"received",label:"Получено без возвратов, ₽",width:28},{key:"cash",label:"Наличные, ₽",width:18},{key:"noncash",label:"Безналичные, ₽",width:18},{key:"unknown",label:"Другой способ, ₽",width:20},{key:"refunded",label:"Возвращено, ₽",width:18},{key:"remaining",label:"Остаток к оплате, ₽",width:23},{key:"overpaid",label:"Переплата, ₽",width:18},{key:"dueDate",label:"Срок оплаты",width:18},{key:"legacy",label:"Сумма старой записи (справочно), ₽",width:38}
 ],rows},{name:"Поступления",columns:[{key:"date",label:"Дата поступления",width:20},{key:"month",label:"Месяц занятий",width:18},{key:"child",label:"Ученик",width:28},{key:"branch",label:"Округ",width:20},{key:"amount",label:"Сумма, ₽",width:16},{key:"method",label:"Способ оплаты",width:24},{key:"status",label:"Статус",width:24},{key:"refundDate",label:"Дата возврата",width:18},{key:"note",label:"Комментарий",width:38},{key:"refundReason",label:"Причина возврата",width:38}],rows:details}];
}
