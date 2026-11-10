-- Apply after 013. Manager-only edits; enrolled duties keep their history.
begin;
create or replace function public.update_managed_duty(p_duty uuid,p_title text,p_location text,p_start timestamptz,p_end timestamptz,p_capacity integer) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;new_points numeric;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into d from public.duties where id=p_duty for update;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 if d.cancelled or d.signup_closed or d.starts_at<=now() then raise exception 'Alleen komende open diensten kunnen worden gewijzigd.';end if;
 if d.match_id is not null then raise exception 'Wedstrijdgegevens volgen Nevobo. Gebruik team- of lidtoewijzing.';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 200 or p_location is null or length(trim(p_location)) not between 1 and 500 then raise exception 'Vul een titel en locatie in.';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_end<=p_start then raise exception 'Kies geldige toekomstige begin- en eindtijden.';end if;
 if not exists(select 1 from public.seasons s where s.id=d.season_id and (p_start at time zone 'Europe/Amsterdam')::date>=s.starts_on and (p_end at time zone 'Europe/Amsterdam')::date<=s.ends_on) then raise exception 'De dienst moet binnen het seizoen vallen.';end if;
 if p_capacity is null or p_capacity not between 1 and 100 or p_capacity<(select count(*) from public.enrollments where duty_id=d.id and not revoked) then raise exception 'Het aantal plaatsen mag niet lager zijn dan het aantal deelnemers.';end if;
 -- Serialize with enrollment's member lock, after locking this duty.
 perform 1 from public.profiles p where p.id in (select e.member_id from public.enrollments e where e.duty_id=d.id and not e.revoked) order by p.id for update;
 if exists(select 1 from public.enrollments e join public.enrollments other on other.member_id=e.member_id and other.duty_id<>d.id and not other.revoked join public.duties od on od.id=other.duty_id and not od.cancelled where e.duty_id=d.id and not e.revoked and od.starts_at<p_end and p_start<od.ends_at) then raise exception 'Een deelnemer heeft op deze tijden al een andere dienst. Pas eerst de toewijzing aan.';end if;
 new_points:=case when d.kind='referee' then d.points else round((extract(epoch from (p_end-p_start))/3600)::numeric,2) end;
 if new_points<=0 or new_points>999999.99 then raise exception 'De duur levert geen geldig puntenaantal op.';end if;
 update public.duties set title=trim(p_title),location=trim(p_location),starts_at=p_start,ends_at=p_end,capacity=p_capacity,points=new_points where id=d.id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'update_duty',d.id,jsonb_build_object('before',to_jsonb(d),'title',trim(p_title),'location',trim(p_location),'starts_at',p_start,'ends_at',p_end,'capacity',p_capacity,'points',new_points));
 if row(d.title,d.location,d.starts_at,d.ends_at,d.points) is distinct from row(trim(p_title),trim(p_location),p_start,p_end,new_points) then
  insert into public.notifications(member_id,title,body) select e.member_id,'Dienst gewijzigd',format('%s · %s · %s',trim(p_title),to_char(p_start at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),trim(p_location)) from public.enrollments e where e.duty_id=d.id and not e.revoked;
 end if;
end;$$;
revoke all on function public.update_managed_duty(uuid,text,text,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.update_managed_duty(uuid,text,text,timestamptz,timestamptz,integer) to authenticated;
notify pgrst,'reload schema';
commit;
