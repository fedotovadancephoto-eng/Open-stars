create or replace function public.parent_document_body(p_profile_id uuid, p_child_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_parent public.users_profile%rowtype;
  v_child public.children%rowtype;
  v_details public.parent_document_details%rowtype;
  v_contract_no text;
begin
  select * into v_parent from public.users_profile where id=p_profile_id;
  select * into v_child from public.children where id=p_child_id;
  select * into v_details from public.parent_document_details where profile_id=p_profile_id and child_id=p_child_id;

  if p_code='esign_agreement' then
    return 'СОГЛАШЕНИЕ ОБ ЭЛЕКТРОННОМ ВЗАИМОДЕЙСТВИИ И ПРОСТОЙ ЭЛЕКТРОННОЙ ПОДПИСИ\nдля личного кабинета OPEN STARS\n\nРедакция: 05.09.2026\n\nИП Федотова Кристина Владимировна, ОГРНИП 325385000099892, ИНН 382704208992, и пользователь родительского личного кабинета OPEN STARS договорились использовать электронные документы и простую электронную подпись. Пользователь идентифицируется по авторизованному родительскому аккаунту. Открытие полной версии документа, установка отдельной заранее не отмеченной галочки и нажатие кнопки подписания признаются простой электронной подписью Пользователя. SMS-код для каждого документа не требуется. OPEN STARS фиксирует идентификатор Пользователя и ребёнка, код и версию документа, дату и время, решение и контрольную сумму текста. Существенно изменённая редакция документа требует нового отдельного согласия. Для добровольных согласий Пользователь вправе отказаться или отозвать согласие без прекращения обучения ребёнка.';
  elsif p_code='personal_data' then
    return 'СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ\nOPEN STARS\n\nРедакция: 05.09.2026\n\nЯ, '||coalesce(v_parent.full_name,'родитель / законный представитель')||', телефон '||coalesce(v_parent.phone,'')||', как законный представитель ребёнка '||trim(coalesce(v_child.first_name,'')||' '||coalesce(v_child.last_name,''))||', даю ИП Федотовой Кристине Владимировне, ИНН 382704208992, ОГРНИП 325385000099892, согласие на обработку моих персональных данных и персональных данных ребёнка.\n\nЦели: заключение и исполнение договора на обучение; организация образовательного процесса; формирование групп и расписания; учёт посещаемости и результатов; ведение начислений, оплат, задолженности и возвратов; предоставление доступа к родительскому кабинету; связь по вопросам обучения, расписания, мероприятий и оплат; исполнение требований законодательства.\n\nМогут обрабатываться ФИО, телефон, адрес проживания, e-mail, сведения о ребёнке, обучении, расписании, посещаемости, начислениях и оплатах и иные предоставленные мной данные, необходимые для этих целей. Разрешаются сбор, запись, систематизация, накопление, хранение, уточнение, использование, передача в необходимых по закону и договору случаях, блокирование и удаление с использованием автоматизации и без неё.\n\nСогласие действует до достижения целей обработки либо до отзыва, если дальнейшая обработка не осуществляется на ином законном основании. Отзыв возможен письменным обращением Исполнителю или через функциональность OPEN STARS. Это согласие не является согласием на публичное распространение фото/видео ребёнка.';
  elsif p_code='photo_video' then
    return 'СОГЛАСИЕ НА ИСПОЛЬЗОВАНИЕ ИЗОБРАЖЕНИЯ РЕБЁНКА И РАСПРОСТРАНЕНИЕ ПЕРСОНАЛЬНЫХ ДАННЫХ\nOPEN STARS\n\nРедакция: 05.09.2026\n\nЯ, '||coalesce(v_parent.full_name,'родитель / законный представитель')||', как законный представитель ребёнка '||trim(coalesce(v_child.first_name,'')||' '||coalesce(v_child.last_name,''))||', добровольно разрешаю ИП Федотовой Кристине Владимировне использовать фотографии и видеозаписи с изображением ребёнка, созданные во время занятий, показов, фотопроектов, конкурсов и иных мероприятий OPEN STARS, и распространять их в информационных и рекламных материалах OPEN STARS, на официальном сайте и официальных страницах/сообществах OPEN STARS. Допускается указывать имя ребёнка, возрастную категорию, филиал/группу и достижения только в объёме, необходимом для публикации. Не допускается публикация адреса, телефона родителя, платёжных данных и иных не относящихся к цели сведений. Согласие добровольное; отказ не влияет на обучение. Я вправе отозвать согласие, после чего OPEN STARS прекращает новое распространение и принимает разумные меры по удалению материалов из подконтрольных ресурсов, если иное не предусмотрено законом.';
  elsif p_code='education_contract' then
    v_contract_no:=upper(left(replace(p_child_id::text,'-',''),8))||'-'||to_char(current_date,'YYYY');
    return 'ДОГОВОР № '||v_contract_no||'\nоб обучении в OPEN STARS\n\nг. Иркутск\n\nИП Федотова Кристина Владимировна, ОГРНИП 325385000099892, ИНН 382704208992, осуществляющая образовательную деятельность на основании лицензии № 035-01220-38/03861554 от 28.11.2025, именуемая «Исполнитель», и '||coalesce(v_parent.full_name,'родитель / законный представитель')||', законный представитель несовершеннолетнего '||trim(coalesce(v_child.first_name,'')||' '||coalesce(v_child.last_name,''))||', именуемый(ая) «Заказчик», заключили настоящий Договор.\n\n1. ПРЕДМЕТ ДОГОВОРА. Исполнитель организует обучение ребёнка в OPEN STARS по утверждённой дополнительной общеобразовательной программе и расписанию соответствующего филиала. Филиал ребёнка на дату подписания: '||coalesce(v_child.branch,'OPEN STARS')||'.\n\n2. ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ И СТОИМОСТЬ. Родителю не требуется выбирать тариф или пакет при подписании настоящего Договора. Стоимость, скидка, объём занятий и расчётный период могут быть индивидуальными для ребёнка и отражаются в начислениях/индивидуальных условиях в личном кабинете OPEN STARS до соответствующей оплаты. Такие индивидуальные условия являются частью настоящего Договора для соответствующего расчётного периода. Переход на иной объём занятий, дополнительное направление, индивидуальная скидка или скидка на второго ребёнка учитываются в последующих индивидуальных условиях и начислениях.\n\n3. ПОРЯДОК ОПЛАТЫ. Оплата производится по реквизитам Исполнителя, через доступные в OPEN STARS платёжные способы либо наличными с фиксацией фактического поступления в системе. До оплаты родителю доступна сумма соответствующего начисления.\n\n4. ОБУЧЕНИЕ И ОРГАНИЗАЦИЯ ЗАНЯТИЙ. Исполнитель организует образовательный процесс, обеспечивает условия занятий и информирует об изменениях расписания. Заказчик предоставляет достоверные сведения, своевременно оплачивает согласованные услуги и обеспечивает соблюдение ребёнком правил безопасности.\n\n5. ПРОПУСКИ И ОТРАБОТКИ. Пропуск отдельного занятия по причинам, не связанным с неоказанием услуги Исполнителем, сам по себе не означает автоматического уменьшения стоимости. Возможность отработки определяется Исполнителем с учётом программы, расписания и наличия места.\n\n6. ОТКАЗ ОТ ДОГОВОРА. Заказчик вправе отказаться от исполнения Договора в порядке законодательства Российской Федерации с расчётом за фактически оказанные услуги и фактически понесённые Исполнителем расходы. Неоказанная часть предварительно оплаченных услуг не является безусловно невозвратной.\n\n7. ЭЛЕКТРОННОЕ ПОДПИСАНИЕ. Договор заключается электронно в личном кабинете OPEN STARS: Заказчик читает полную версию, ставит отдельную галочку и нажимает кнопку подписания. Система сохраняет идентификаторы, версию и контрольную сумму текста, дату и время.\n\n8. ПЕРСОНАЛЬНЫЕ ДАННЫЕ И ФОТО/ВИДЕО. Согласия на обработку персональных данных и фото/видео оформляются отдельно. Отказ от фото/видео не влияет на обучение.\n\nРЕКВИЗИТЫ: ИП Федотова Кристина Владимировна; ИНН 382704208992; ОГРНИП 325385000099892; лицензия № 035-01220-38/03861554 от 28.11.2025; р/с 40802810520000750085; ООО «Банк Точка»; к/с 30101810745374525104; БИК 044525104.\n\nЗАКАЗЧИК: '||coalesce(v_parent.full_name,'')||'; телефон '||coalesce(v_parent.phone,'')||'; e-mail '||coalesce(v_details.email,'')||'; адрес '||coalesce(v_details.parent_address,'')||'.\nОБУЧАЮЩИЙСЯ: '||trim(coalesce(v_child.first_name,'')||' '||coalesce(v_child.last_name,''))||'; дата рождения '||coalesce(to_char(v_child.birth_date,'DD.MM.YYYY'),'')||'; адрес '||coalesce(v_details.child_address,'')||'.\n\nДоговор вступает в силу с момента электронного подписания и действует до прекращения обучения либо расторжения Договора.';
  end if;
  return null;
end
$function$;

create or replace function public.parent_sign_document(p_child_id uuid, p_code text, p_decision text default 'accept'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_profile_id uuid;
  v_body text;
  v_hash text;
  v_signed_at timestamptz:=now();
  v_esign text;
begin
  select id into v_profile_id from public.users_profile where auth_user_id=auth.uid();
  if v_profile_id is null then raise exception 'parent profile not found'; end if;
  if not exists(select 1 from public.children c where c.id=p_child_id and exists(select 1 from public.family_members fm where fm.family_id=c.family_id and fm.user_id=v_profile_id)) then raise exception 'child access denied'; end if;
  if p_code not in('esign_agreement','personal_data','education_contract','photo_video') then raise exception 'unknown document'; end if;
  if p_decision not in('accept','decline','revoke') then raise exception 'unknown decision'; end if;
  if p_code in('esign_agreement','personal_data','education_contract') and p_decision<>'accept' then raise exception 'required document cannot be declined'; end if;
  if p_code<>'esign_agreement' then
    select s.decision into v_esign from public.parent_document_signatures s where s.profile_id=v_profile_id and s.child_id=p_child_id and s.code='esign_agreement' order by s.signed_at desc limit 1;
    if v_esign is distinct from 'accept' then raise exception 'sign electronic agreement first'; end if;
  end if;
  if p_code in('personal_data','education_contract') and not exists(select 1 from public.parent_document_details d where d.profile_id=v_profile_id and d.child_id=p_child_id and length(trim(d.parent_address))>=5 and length(trim(d.child_address))>=5) then raise exception 'document details required'; end if;
  v_body:=public.parent_document_body(v_profile_id,p_child_id,p_code);
  if v_body is null then raise exception 'document template not found'; end if;
  v_hash:=encode(extensions.digest(convert_to(v_body||'|'||v_profile_id::text||'|'||p_child_id::text||'|1','UTF8'),'sha256'),'hex');
  insert into public.parent_document_signatures(profile_id,child_id,code,version,decision,document_hash,document_body,signed_at)
  values(v_profile_id,p_child_id,p_code,1,p_decision,v_hash,v_body,v_signed_at);
  return jsonb_build_object('ok',true,'status',p_decision,'hash',v_hash,'signedAt',v_signed_at);
end
$function$;

notify pgrst, 'reload schema';
