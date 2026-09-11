-- Accounting services are a separate expense category in the shared live catalog.
insert into public.expense_categories(code,name,category_type,is_active,sort_order,owner_only)
values ('accounting','Бухгалтерский учёт','fixed',true,35,false)
on conflict (code) do update
set name=excluded.name,
    is_active=true,
    updated_at=now();
