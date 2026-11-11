import { useState } from "react";
import { reportRestSelect } from "./reportExportShared";
import { createXlsxBlob } from "./xlsxExport";
import { useEffect } from "react";
const labels:Record<string,string>={payment_receipt:"Оплата",teacher_payroll:"Оплата труда",expense_request:"Заявка на расход",owner_direct_expense:"Прямой расход",crm_campaign_expense:"Расход на рекламу",tuition_refund:"Возврат оплаты"};
export function CashbookExport(){
 const [busy,B]=useState(false),[url,U]=useState(""),[error,E]=useState("");
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url]);
 async function run(){B(true);E("");U("");try{
 const records=await reportRestSelect("cashflow_transactions","id,transaction_date,direction,amount,description,source_type,branches(name),expense_categories(name),cash_accounts(name),actor:users_profile!cashflow_transactions_created_by_profile_id_fkey(staff_display_name,full_name)","transaction_date.asc,id.asc");
 const columns=[["dt","Дата",16],["branch","Филиал",26],["income","Поступление, ₽",20],["expense","Расход, ₽",20],["cat","Категория",32],["account","Счёт",26],["src","Вид операции",26],["note","Описание",60],["actor","Внёс",32],["id","ID операции",40]].map(([key,label,width])=>({key:String(key),label:String(label),width:Number(width)}));
 const rows=records.map(r=>({dt:r.transaction_date,branch:r.branches?.name||"Общий / распределённый",income:r.direction==="income"?Number(r.amount):null,expense:r.direction==="expense"?Number(r.amount):null,cat:r.expense_categories?.name,account:r.cash_accounts?.name,src:labels[r.source_type]||r.source_type,note:r.description,actor:r.actor?.staff_display_name||r.actor?.full_name,id:r.id}));
 const link=URL.createObjectURL(createXlsxBlob([{name:"Операции",columns,rows}]));U(link);const a=document.createElement("a");a.href=link;a.download="OPEN_STARS_finance.xlsx";document.body.appendChild(a);a.click();a.remove();
 }catch(e){E(e instanceof Error?e.message:"Не удалось выгрузить операции.")}finally{B(false)}}
 return <div className="mt-4"><button type="button" disabled={busy} onClick={()=>void run()} className="rounded-xl bg-black px-4 py-3 text-sm text-white">{busy?"Формируем файл…":"Доходы и расходы в Excel · вся история"}</button>{url&&<a className="ml-3 underline" href={url} download="OPEN_STARS_finance.xlsx">Скачать файл</a>}{error&&<p role="alert">{error}</p>}</div>
}
