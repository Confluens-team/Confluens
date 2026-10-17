-- HU-24 / RN-11 / RN-13 (decisiones del PO y del equipo, 16/10/2026; ADR 0012).
-- 1. La modalidad de un servicio (normal, continuo +20%, en mesas +30%) pasa a ser un dato de la
--    línea del presupuesto, con el precio antes del recargo congelado en precioBase.
-- 2. Los coffee breaks admiten modalidad. Las variantes del Sprint 1 con el recargo ya incluido
--    («Coffee X — continuo en salón», «Coffee X — en mesas con mozo») se dan de baja lógica y las
--    líneas que las usaban se convierten al coffee base con su modalidad, mismo precio final.
-- 3. ConfiguracionPrecios: fila única con el porcentaje de incremento mensual, en 0.

-- CreateEnum
CREATE TYPE "ModalidadServicio" AS ENUM ('Normal', 'Continuo', 'EnMesa');

-- AlterTable
ALTER TABLE "LineaPresupuesto" ADD COLUMN     "modalidad" "ModalidadServicio" NOT NULL DEFAULT 'Normal',
ADD COLUMN     "precioBase" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "admiteModalidad" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConfiguracionPrecios" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "porcentajeMensual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPrecios_pkey" PRIMARY KEY ("id")
);

-- Fila única: no puede haber otra configuración de precios.
ALTER TABLE "ConfiguracionPrecios" ADD CONSTRAINT "configuracion_precios_fila_unica" CHECK ("id" = 1);

INSERT INTO "ConfiguracionPrecios" ("id", "porcentajeMensual", "actualizadoEn")
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Las líneas de servicio que ya existen no tenían recargo propio: su precio base es el unitario.
UPDATE "LineaPresupuesto" SET "precioBase" = "precioUnitario" WHERE "servicioId" IS NOT NULL;

-- Coffee base = el servicio cuyo nombre es el de la variante sin el sufijo. Por nombre, porque los
-- ids cambian entre entornos.
UPDATE "Servicio" AS base
   SET "admiteModalidad" = true
  FROM "Servicio" AS variante
 WHERE (variante."nombre" LIKE '% — continuo en salón' OR variante."nombre" LIKE '% — en mesas con mozo')
   AND base."nombre" = split_part(variante."nombre", ' — ', 1);

-- Cada línea que usaba una variante pasa al coffee base, con la modalidad que la variante tenía
-- incluida. El precio unitario y el subtotal no cambian: precioBase es el unitario sin el recargo
-- (los precios base del tarifario son enteros, así que la división es exacta).
UPDATE "LineaPresupuesto" AS linea
   SET "servicioId" = base."id",
       "descripcion" = base."nombre",
       "modalidad" = CASE WHEN variante."nombre" LIKE '% — continuo en salón'
                          THEN 'Continuo'::"ModalidadServicio"
                          ELSE 'EnMesa'::"ModalidadServicio" END,
       "precioBase" = ROUND(linea."precioUnitario" /
                            CASE WHEN variante."nombre" LIKE '% — continuo en salón' THEN 1.2 ELSE 1.3 END, 2)
  FROM "Servicio" AS variante, "Servicio" AS base
 WHERE linea."servicioId" = variante."id"
   AND (variante."nombre" LIKE '% — continuo en salón' OR variante."nombre" LIKE '% — en mesas con mozo')
   AND base."nombre" = split_part(variante."nombre", ' — ', 1);

-- Las variantes quedan de baja lógica: no se borran, para no romper ninguna referencia que
-- quede, pero no se ofrecen más.
UPDATE "Servicio"
   SET "activo" = false
 WHERE "nombre" LIKE '% — continuo en salón' OR "nombre" LIKE '% — en mesas con mozo';
