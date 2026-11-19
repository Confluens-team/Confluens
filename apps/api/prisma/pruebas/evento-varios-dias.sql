-- Pruebas de las reglas de la base de HU-50 (docs/tecnico/adr/0014-evento-de-varios-dias-con-dias-propios.md).
--
-- Los tests automáticos del proyecto usan una base falsa y no pueden comprobar lo que garantiza
-- Postgres: el no solapamiento por día y por salón, los días consecutivos con tope de 32 y el resumen
-- del evento. Este script lo comprueba contra una base real, a mano:
--
--   docker exec -i confluens-db psql -U confluens -d <base> -v ON_ERROR_STOP=1 \
--     < apps/api/prisma/pruebas/evento-varios-dias.sql
--
-- Cada caso corre en una subtransacción que SIEMPRE se revierte: no deja nada en la base, ni siquiera
-- en la de demo. Usa fechas del año 2040 para no cruzarse con ningún evento real. Imprime una línea
-- por caso («OK» o «FALLA») y termina con error si algún caso falla.
--
-- Los controles diferidos (constraint triggers) no se disparan en un ROLLBACK: por eso cada caso termina
-- con SET CONSTRAINTS ALL IMMEDIATE, que los fuerza antes de revertir. Sin eso, los casos de días
-- consecutivos, tope y salón por día pasarían en silencio.

CREATE TEMP TABLE resultado (orden serial, nombre text, esperado text, obtenido text);

CREATE FUNCTION pg_temp.ev(f date) RETURNS int AS $$
  INSERT INTO "Evento" ("clienteId", "fecha", "cantidadPersonas", "actualizadoEn")
  VALUES ((SELECT min("id") FROM "Cliente"), f, 1, now())
  RETURNING "id";
$$ LANGUAGE sql;

-- Un día del evento. «siguiente» hace que la hora de fin caiga al día siguiente (pasa la medianoche).
CREATE FUNCTION pg_temp.dia(ev int, f date, ini time, fin time, pers int DEFAULT 10,
                            jor text DEFAULT 'completa', siguiente boolean DEFAULT false) RETURNS int AS $$
  INSERT INTO "EventoDia" ("eventoId", "fecha", "inicio", "fin", "tipoJornada", "cantidadPersonas", "actualizadoEn")
  VALUES (ev, f, f + ini, CASE WHEN siguiente THEN f + 1 + fin ELSE f + fin END, jor::"TipoJornada", pers, now())
  RETURNING "id";
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.sal(d int, s int) RETURNS void AS $$
  INSERT INTO "EventoSalon" ("eventoId", "diaId", "salonId")
  VALUES ((SELECT "eventoId" FROM "EventoDia" WHERE "id" = d), d, s);
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.estado(ev int, e text) RETURNS void AS $$
  UPDATE "Evento" SET "estado" = e::"EstadoEvento" WHERE "id" = ev;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.afirmar(condicion boolean, mensaje text) RETURNS void AS $$
BEGIN
  IF condicion IS NOT TRUE THEN
    RAISE EXCEPTION 'afirmación falsa: %', mensaje USING ERRCODE = 'ZZ002';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.informar(nombre text, esperado text, obtenido text) RETURNS void AS $$
BEGIN
  INSERT INTO resultado (nombre, esperado, obtenido) VALUES (nombre, esperado, obtenido);
  RAISE NOTICE '% | % (esperado %, obtenido %)',
    CASE WHEN esperado = obtenido THEN 'OK   ' ELSE 'FALLA' END, nombre, esperado, obtenido;
END;
$$ LANGUAGE plpgsql;

DO $prueba$
DECLARE
  d date := date '2040-03-10';
  s1 int := (SELECT "id" FROM "Salon" ORDER BY "id" LIMIT 1);
  s2 int := (SELECT "id" FROM "Salon" ORDER BY "id" OFFSET 1 LIMIT 1);
  x int; y int; a int; b int; c int; z int;
BEGIN
  -- Convención de cada caso: DEFERRED, armar, IMMEDIATE (fuerza los controles diferidos), y un
  -- ZZ001 para revertir. «ZZ001» quiere decir que todo salió bien; cualquier otro SQLSTATE es el error.

  -- ========================= Resumen del evento a partir de sus días =========================
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d,     '09:00', '18:00', 10, 'media');
    PERFORM pg_temp.dia(x, d + 1, '08:00', '12:00', 30, 'completa');
    PERFORM pg_temp.dia(x, d + 2, '10:00', '20:00', 20, 'media');
    PERFORM pg_temp.afirmar((SELECT "fecha" = d AND "fechaFin" = d + 2
      AND "inicio" = d + time '09:00' AND "fin" = d + 2 + time '20:00'
      AND "cantidadPersonas" = 30 AND "tipoJornada" = 'media'
      FROM "Evento" WHERE "id" = x), 'resumen de 3 días');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('resumen: primer y último día, máximo de personas, jornada del primero', 'ZZ001', SQLSTATE);
  END;

  -- ===================== Días consecutivos y tope de 32 (cambio de mes incluido) =====================
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d, '09:00', '18:00');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('un solo día es válido (todos los eventos de hoy)', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    PERFORM pg_temp.ev(d);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('un evento sin días se rechaza', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(date '2040-04-30');
    PERFORM pg_temp.dia(x, date '2040-04-30' + g, '09:00', '18:00') FROM generate_series(0, 31) g;  -- 30/04 al 31/05: 32 días
    PERFORM pg_temp.afirmar((SELECT "fechaFin" = date '2040-05-31' FROM "Evento" WHERE "id" = x), 'fin 31/05');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('32 días del 30/04 al 31/05 (fin de un mes a fin del siguiente): válido', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(date '2040-04-30');
    PERFORM pg_temp.dia(x, date '2040-04-30' + g, '09:00', '18:00') FROM generate_series(0, 32) g;  -- hasta el 01/06: 33 días
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('33 días: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(date '2040-12-20');
    PERFORM pg_temp.dia(x, date '2040-12-20' + g, '09:00', '18:00') FROM generate_series(0, 31) g;  -- 20/12 al 20/01: 32 días, cruza el año
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('32 días que cruzan el año: válido', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(date '2044-02-01');
    PERFORM pg_temp.dia(x, date '2044-02-01' + g, '09:00', '18:00') FROM generate_series(0, 28) g;  -- 01/02 al 29/02 (bisiesto): 29 días
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('febrero bisiesto completo (29 días): válido', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d,     '09:00', '18:00');
    PERFORM pg_temp.dia(x, d + 2, '09:00', '18:00');  -- falta el día del medio
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('un hueco en el medio de la franja: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d,     '09:00', '18:00');
    a := pg_temp.dia(x, d + 1, '09:00', '18:00');
    PERFORM pg_temp.dia(x, d + 2, '09:00', '18:00');
    DELETE FROM "EventoDia" WHERE "id" = a;  -- sacar el día del medio
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('sacar el día del medio: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d,     '09:00', '18:00');
    PERFORM pg_temp.dia(x, d + 1, '09:00', '18:00');
    a := pg_temp.dia(x, d + 2, '09:00', '20:00');
    DELETE FROM "EventoDia" WHERE "id" = a;  -- sacar el último día achica la franja
    PERFORM pg_temp.afirmar((SELECT "fechaFin" = d + 1 AND "fin" = d + 1 + time '18:00' FROM "Evento" WHERE "id" = x), 'resumen tras achicar');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('sacar el último día: válido y el resumen se corrige', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00');
    PERFORM pg_temp.dia(x, d + 1, '09:00', '18:00');
    UPDATE "EventoDia" SET "fecha" = d + 5 WHERE "id" = a;  -- mover un día suelto lejos de la franja
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('mover un día suelto fuera de la franja: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d, '09:00', '18:00');
    PERFORM pg_temp.dia(x, d, '10:00', '12:00');  -- el mismo día dos veces
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el mismo día dos veces en un evento: rechazado', '23505', SQLSTATE);
  END;

  -- ================= Reservado o Cobrado: horario y al menos un salón en cada día =================
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('Reservado con horario y salón en cada día: válido', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.dia(x, d + 1, '09:00', '18:00');  -- este día se queda sin salón
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('Reservado con un día sin salón: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    c := pg_temp.dia(x, d + 2, '09:00', '18:00'); PERFORM pg_temp.sal(c, s1);
    UPDATE "EventoDia" SET "inicio" = NULL WHERE "id" = b;  -- el día del medio sin horario
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('Reservado con un día del medio sin horario: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    PERFORM pg_temp.dia(x, d + 1, '09:00', '18:00');  -- se extiende el evento ya reservado con un día sin salón
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('extender un Reservado con un día sin salón: rechazado', '23514', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);  -- extender, con su salón
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('extender un Reservado con un día con salón: válido', 'ZZ001', SQLSTATE);
  END;

  -- ====================== Solapamiento por día y por salón (RN-12) ======================
  -- El evento X ocupa el salón s1 los días d y d+1, de 09:00 a 18:00.
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d + 1);
    c := pg_temp.dia(y, d + 1, '10:00', '12:00'); PERFORM pg_temp.sal(c, s1);  -- se pisa con el segundo día de X
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('mismo salón, mismo día, horarios que se pisan: rechazado (23P01)', '23P01', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d + 1);
    c := pg_temp.dia(y, d + 1, '18:00', '22:00'); PERFORM pg_temp.sal(c, s1);  -- empieza justo cuando X termina
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el borde: uno termina a las 18:00 y otro empieza a las 18:00 no chocan', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d + 2);
    c := pg_temp.dia(y, d + 2, '09:00', '18:00'); PERFORM pg_temp.sal(c, s1);  -- el día siguiente al último de X
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el mismo salón el día siguiente a la franja: no choca', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d + 1);
    c := pg_temp.dia(y, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(c, s2);  -- otro salón el mismo día
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('otro salón el mismo día y horario: no choca', 'ZZ001', SQLSTATE);
  END;

  -- El caso central de HU-50: X usa s1 el primero y el tercer día y s2 el del medio. Otro evento
  -- puede tomar s1 el día del medio: cada día se controla solo.
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s2);
    c := pg_temp.dia(x, d + 2, '09:00', '18:00'); PERFORM pg_temp.sal(c, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d + 1);
    z := pg_temp.dia(y, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(z, s1);  -- el hueco del salón s1 en el día del medio
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el salón libre un día del medio de una franja se puede reservar', 'ZZ001', SQLSTATE);
  END;

  -- Las filas de un mismo evento no chocan entre sí: un día que pasa la medianoche pisa al siguiente.
  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '20:00', '02:00', 10, 'completa', true); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '00:00', '10:00');                       PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('dos días del MISMO evento que se pisan en un salón: no choca (es el mismo evento)', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d, '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    y := pg_temp.ev(d);
    b := pg_temp.dia(y, d, '10:00', '12:00'); PERFORM pg_temp.sal(b, s1);  -- una consulta (EnConsulta) no bloquea ni es bloqueada
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('una consulta EnConsulta no bloquea el salón (RN-12)', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d, '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    PERFORM pg_temp.estado(x, 'Cancelado');  -- cancelar libera el salón
    y := pg_temp.ev(d);
    b := pg_temp.dia(y, d, '10:00', '12:00'); PERFORM pg_temp.sal(b, s1);
    PERFORM pg_temp.estado(y, 'Reservado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('cancelar un evento libera sus salones', 'ZZ001', SQLSTATE);
  END;

  -- ============================ Resumen y copias que mantiene la base ============================
  BEGIN
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d, '09:00', '18:00');
    UPDATE "Evento" SET "inicio" = d + time '10:00' WHERE "id" = x;  -- escribir el resumen a mano
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('escribir el resumen del evento a mano: rechazado por la guarda', '23514', SQLSTATE);
  END;

  BEGIN
    x := pg_temp.ev(d);
    PERFORM pg_temp.dia(x, d, '09:00', '18:00');
    UPDATE "Evento" SET "observaciones" = 'una nota', "modalidadSalonRestaurante" = true WHERE "id" = x;  -- otros campos sí se escriben
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('escribir campos del evento que no son el resumen: válido', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    UPDATE "EventoDia" SET "inicio" = d + time '14:00', "fin" = d + time '16:00' WHERE "id" = a;
    PERFORM pg_temp.afirmar((SELECT "inicio" = d + time '14:00' AND "fin" = d + time '16:00'
      FROM "EventoSalon" WHERE "diaId" = a), 'el horario del día A llega a sus salones');
    PERFORM pg_temp.afirmar((SELECT "inicio" = d + 1 + time '09:00' AND "fin" = d + 1 + time '18:00'
      FROM "EventoSalon" WHERE "diaId" = b), 'el día B no se toca');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el horario de un día se copia a SUS salones y no a los de otro día', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d, '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    PERFORM pg_temp.estado(x, 'Reservado');
    PERFORM pg_temp.afirmar((SELECT "estado" = 'Reservado' FROM "EventoSalon" WHERE "diaId" = a), 'estado propagado');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('el estado del evento se copia a los salones de todos sus días', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    y := pg_temp.ev(d + 20);
    a := pg_temp.dia(x, d, '09:00', '18:00');
    b := pg_temp.dia(y, d + 20, '09:00', '18:00');
    INSERT INTO "EventoSalon" ("eventoId", "diaId", "salonId") VALUES (y, a, s1);  -- eventoId equivocado a propósito
    PERFORM pg_temp.afirmar((SELECT "eventoId" = x FROM "EventoSalon" WHERE "diaId" = a), 'eventoId sale del día');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;  -- ahora el segundo evento, que también se arma de a pasos
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('EventoSalon.eventoId sale del día: no puede discrepar con él', 'ZZ001', SQLSTATE);
  END;

  BEGIN
    SET CONSTRAINTS ALL DEFERRED;
    x := pg_temp.ev(d);
    a := pg_temp.dia(x, d,     '09:00', '18:00'); PERFORM pg_temp.sal(a, s1);
    b := pg_temp.dia(x, d + 1, '09:00', '18:00'); PERFORM pg_temp.sal(b, s1);
    DELETE FROM "Evento" WHERE "id" = x;
    PERFORM pg_temp.afirmar(NOT EXISTS (SELECT 1 FROM "EventoDia" WHERE "eventoId" = x), 'sin días');
    PERFORM pg_temp.afirmar(NOT EXISTS (SELECT 1 FROM "EventoSalon" WHERE "eventoId" = x), 'sin salones');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'listo' USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.informar('borrar un evento borra sus días y sus salones sin tropezar con los controles', 'ZZ001', SQLSTATE);
  END;
END
$prueba$;

-- ============================== Resumen ==============================
SELECT count(*) AS casos,
       count(*) FILTER (WHERE obtenido = ANY (string_to_array(esperado, '|'))) AS ok,
       count(*) FILTER (WHERE NOT (obtenido = ANY (string_to_array(esperado, '|')))) AS fallan
  FROM resultado;

DO $fin$
BEGIN
  IF EXISTS (SELECT 1 FROM resultado WHERE NOT (obtenido = ANY (string_to_array(esperado, '|')))) THEN
    RAISE EXCEPTION 'Fallaron casos de las reglas de la base de HU-50 (ver las líneas FALLA)';
  END IF;
END
$fin$;
