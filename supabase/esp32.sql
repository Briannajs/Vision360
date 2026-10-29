-- ============================================================
-- Vision360 - Puente entre la app y el ESP32
--
-- Usa SOLO la tabla existente public.evento.
-- No crea tablas nuevas.
--
-- Ejecutar completo en el SQL Editor de Supabase.
--
-- Cómo funciona:
--   1. La app inserta un evento (panico / incendio / emergencia).
--   2. El ESP32 consulta esp32_poll() cada pocos segundos con su token
--      y recibe los eventos nuevos.
--   3. La app cambia evento.estado_alarma a "silenciada" o "detenida"
--      llamando a marcar_estado_alarma(). Puede hacerlo CUALQUIER
--      celular del barrio, no solo el que disparó la alarma.
--   4. En cada consulta el ESP32 recibe también el estado actual de la
--      alarma que está sonando, así que se silencia o detiene aunque se
--      haya perdido el momento exacto del cambio.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Limpieza de una versión anterior descartada (si existiera)
-- ------------------------------------------------------------
drop function if exists public.esp32_poll(text, bigint);
drop function if exists public.esp32_ack(text, bigint);

-- ------------------------------------------------------------
-- 1. Consulta del ESP32
--
-- p_token         token del dispositivo (el mismo del .ino)
-- p_after         último id_evento que ya procesó
-- p_evento_actual id del evento que está sonando (0 si ninguno)
-- ------------------------------------------------------------
create or replace function public.esp32_poll(
  p_token text,
  p_after bigint default 0,
  p_evento_actual bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- >>> CAMBIÁ ESTE TOKEN por uno propio y usá el mismo en el .ino <<<
  v_token constant text := 'v360_esp32_9f4c2a7b1e6d8053';
  v_eventos jsonb;
  v_ultimo_id bigint;
  v_estado_actual text;
begin
  if p_token is null or p_token <> v_token then
    raise exception 'Token de dispositivo inválido' using errcode = '28000';
  end if;

  -- Eventos nuevos (máximo 10 por consulta).
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id_evento), '[]'::jsonb)
    into v_eventos
    from (
      select id_evento, tipo, estado_alarma, fecha_hora
        from public.evento
       where id_evento > coalesce(p_after, 0)
       order by id_evento asc
       limit 10
    ) e;

  select coalesce(max(id_evento), 0)
    into v_ultimo_id
    from public.evento;

  -- Estado de la alarma que el ESP32 tiene sonando.
  if p_evento_actual is not null and p_evento_actual > 0 then
    select estado_alarma
      into v_estado_actual
      from public.evento
     where id_evento = p_evento_actual;
  end if;

  return jsonb_build_object(
    'eventos', v_eventos,
    'ultimo_id', v_ultimo_id,
    'estado_actual', v_estado_actual
  );
end;
$$;

-- ------------------------------------------------------------
-- 2. Silenciar / detener desde la app
--
-- Cualquier vecino del barrio puede hacerlo, no solo quien disparó
-- la alarma. No toca el hardware: cambia el estado del evento y el
-- ESP32 lo lee en su próxima consulta.
-- ------------------------------------------------------------
create or replace function public.marcar_estado_alarma(
  p_id_evento bigint,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '28000';
  end if;

  if p_estado is null or p_estado not in ('activa', 'silenciada', 'detenida') then
    raise exception 'Estado inválido: %', p_estado using errcode = '22023';
  end if;

  -- Cualquier vecino del barrio puede silenciar o detener la alarma,
  -- no hace falta ser quien la disparó. Lo que NO se permite es que un
  -- vecino de otro barrio corte una alarma ajena.
  update public.evento e
     set estado_alarma = p_estado
   where e.id_evento = p_id_evento
     and (
       e.id_barrio is null
       or exists (
         select 1
           from public.perfiles p
          where p.id = auth.uid()
            and p.id_barrio = e.id_barrio
       )
     );

  if not found then
    raise exception 'No podés detener esa alarma: no existe o es de otro barrio'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id_evento', p_id_evento,
    'estado_alarma', p_estado
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. Acceso de los vecinos del barrio
--
-- Todos los celulares del barrio tienen que poder LEER la alarma en
-- curso para poder detenerla. Si `evento` tiene RLS activado, esta
-- política lo permite; si RLS está desactivado, no molesta.
-- ------------------------------------------------------------
drop policy if exists "vecinos leen eventos de su barrio" on public.evento;
create policy "vecinos leen eventos de su barrio"
  on public.evento
  for select
  to authenticated
  using (
    id_barrio is null
    or id_barrio in (
      select p.id_barrio from public.perfiles p where p.id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Permisos
--
-- El ESP32 usa la publishable key (rol anon) y su token.
-- La app usa el usuario logueado (rol authenticated).
-- ------------------------------------------------------------
revoke all on function public.esp32_poll(text, bigint, bigint) from public;
revoke all on function public.marcar_estado_alarma(bigint, text) from public;

grant execute on function public.esp32_poll(text, bigint, bigint) to anon, authenticated;
grant execute on function public.marcar_estado_alarma(bigint, text) to authenticated;

-- Refresca la caché de funciones de la API REST.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Verificación (opcional)
-- ------------------------------------------------------------
-- select public.esp32_poll('v360_esp32_9f4c2a7b1e6d8053', 0, 0);
-- select id_evento, tipo, estado_alarma, fecha_hora
--   from public.evento
--  order by id_evento desc
--  limit 10;
