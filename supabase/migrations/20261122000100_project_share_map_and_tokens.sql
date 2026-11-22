-- Calculator-Taniku: keep owner-copyable share tokens and expose saved field polygons
-- Applied to Supabase project gevrnbqksgjlvpqjtmtl on 2026-11-22.
alter table public.work_project_shares
  add column if not exists share_token text;

create or replace function public.read_work_project_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','extensions'
as $function$
declare
  v_share public.work_project_shares%rowtype;
  v_project public.work_projects%rowtype;
  v_items jsonb;
  v_payments jsonb;
  v_village text;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return null;
  end if;

  select * into v_share
  from public.work_project_shares s
  where s.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1;
  if not found then return null; end if;

  select * into v_project
  from public.work_projects p
  where p.id = v_share.project_id and p.owner_id = v_share.owner_id;
  if not found then return null; end if;

  select name into v_village
  from public.villages
  where id = v_project.village_id and owner_id = v_share.owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'farmer_id', i.farmer_id,
    'farmer_name', i.farmer_name,
    'field_name', i.field_name,
    'village_id', i.village_id,
    'field_id', i.field_id,
    'boundary_geojson', f.boundary_geojson,
    'area_m2', i.area_m2,
    'kotak_exact', i.kotak_exact,
    'area_per_kotak_m2', i.area_per_kotak_m2,
    'tariff_per_kotak', i.tariff_per_kotak,
    'expected_amount', i.expected_amount,
    'is_active', i.is_active,
    'notes', i.notes
  ) order by i.created_at), '[]'::jsonb)
  into v_items
  from public.work_project_items i
  left join public.fields f
    on f.id = i.field_id and f.owner_id = v_share.owner_id
  where i.project_id = v_project.id and i.owner_id = v_share.owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pay.id,
    'farmer_id', pay.farmer_id,
    'project_item_id', pay.project_item_id,
    'amount_received', pay.amount_received,
    'payment_date', pay.payment_date,
    'notes', pay.notes
  ) order by pay.payment_date, pay.created_at), '[]'::jsonb)
  into v_payments
  from public.work_project_payments pay
  where pay.project_id = v_project.id and pay.owner_id = v_share.owner_id;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'village_id', v_project.village_id,
      'village_name', v_village,
      'work_date', v_project.work_date,
      'notes', v_project.notes,
      'status', v_project.status,
      'updated_at', v_project.updated_at
    ),
    'items', v_items,
    'payments', v_payments,
    'expires_at', v_share.expires_at,
    'generated_at', now()
  );
end
$function$;
