-- ============================================================
--  HUERTO COMUNITARIO - Base de Datos PostgreSQL
--  Versión: 2.0 (completa con auth, chat, notificaciones)
--  Para ejecutar: pgAdmin → Query Tool en huerto_db
-- ============================================================

-- ============================================================
--  RESET COMPLETO (borra todo si existe)
-- ============================================================

DROP TABLE IF EXISTS distribuciones_cosecha CASCADE;
DROP TABLE IF EXISTS cosechas              CASCADE;
DROP TABLE IF EXISTS turnos_riego          CASCADE;
DROP TABLE IF EXISTS siembras              CASCADE;
DROP TABLE IF EXISTS especies              CASCADE;
DROP TABLE IF EXISTS parcelas              CASCADE;
DROP TABLE IF EXISTS mensajes_chat         CASCADE;
DROP TABLE IF EXISTS notificaciones        CASCADE;
DROP TABLE IF EXISTS actividad_vecinos     CASCADE;
DROP TABLE IF EXISTS vecinos               CASCADE;

DROP VIEW IF EXISTS v_riego_hoy        CASCADE;
DROP VIEW IF EXISTS v_cosechas_mes     CASCADE;
DROP VIEW IF EXISTS v_ranking_vecinos  CASCADE;

DROP TYPE IF EXISTS estado_turno    CASCADE;
DROP TYPE IF EXISTS estado_parcela  CASCADE;
DROP TYPE IF EXISTS rol_vecino      CASCADE;
DROP TYPE IF EXISTS estado_cosecha  CASCADE;
DROP TYPE IF EXISTS tipo_notif      CASCADE;

-- ============================================================
--  DDL - DEFINICIÓN DE ESTRUCTURA
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM TYPES ─────────────────────────────────────────────
CREATE TYPE estado_turno    AS ENUM ('pendiente', 'cumplido', 'incumplido');
CREATE TYPE estado_parcela  AS ENUM ('disponible', 'ocupada', 'en_descanso');
CREATE TYPE rol_vecino      AS ENUM ('coordinador', 'miembro');
CREATE TYPE estado_cosecha  AS ENUM ('registrada', 'distribuida');
CREATE TYPE tipo_notif      AS ENUM ('info', 'riego', 'cosecha', 'alerta');

-- ============================================================
-- TABLA: vecinos (con autenticación)
-- Los 18 miembros del huerto + sus credenciales de login
-- ============================================================

CREATE TABLE vecinos (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(100)  NOT NULL,
    apellido        VARCHAR(100)  NOT NULL,
    telefono        VARCHAR(20)   UNIQUE,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    password_hash   TEXT          NOT NULL,
    rol             rol_vecino    NOT NULL DEFAULT 'miembro',
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_ingreso   DATE          NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  vecinos IS 'Miembros del huerto con login. password_hash usa bcrypt.';
COMMENT ON COLUMN vecinos.rol IS 'coordinador: Doña Carmen; miembro: vecino regular.';

-- ============================================================
-- TABLA: parcelas
-- ============================================================

CREATE TABLE parcelas (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          VARCHAR(10)    NOT NULL UNIQUE,
    descripcion     VARCHAR(200),
    area_m2         NUMERIC(6,2)   CHECK (area_m2 > 0),
    estado          estado_parcela NOT NULL DEFAULT 'disponible',
    ubicacion_fila  SMALLINT       NOT NULL,
    ubicacion_col   SMALLINT       NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (ubicacion_fila, ubicacion_col)
);

COMMENT ON TABLE parcelas IS 'Subdivisiones físicas del huerto. Coordenadas únicas evitan colisión espacial.';

-- ============================================================
-- TABLA: especies
-- ============================================================

CREATE TABLE especies (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comun      VARCHAR(100) NOT NULL UNIQUE,
    nombre_cientifico VARCHAR(150),
    dias_cosecha      SMALLINT     CHECK (dias_cosecha > 0),
    notas             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: siembras
-- RF2: Registra qué se sembró, dónde, cuándo y quién
-- ============================================================

CREATE TABLE siembras (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parcela_id             UUID        NOT NULL REFERENCES parcelas(id),
    especie_id             UUID        NOT NULL REFERENCES especies(id),
    vecino_id              UUID        NOT NULL REFERENCES vecinos(id),
    fecha_siembra          DATE        NOT NULL DEFAULT CURRENT_DATE,
    fecha_cosecha_estimada DATE,
    cantidad_plantas       SMALLINT    CHECK (cantidad_plantas > 0),
    notas                  TEXT,
    activa                 BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial: solo una siembra activa por parcela
CREATE UNIQUE INDEX uq_siembra_parcela_activa 
ON siembras (parcela_id) WHERE activa = TRUE;

COMMENT ON TABLE siembras IS 'RF2: El índice único impide dos siembras activas en la misma parcela.';

-- ============================================================
-- TABLA: turnos_riego
-- RF1: Asignación y registro de turnos
-- ============================================================

CREATE TABLE turnos_riego (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parcela_id      UUID         NOT NULL REFERENCES parcelas(id),
    vecino_id       UUID         NOT NULL REFERENCES vecinos(id),
    fecha_turno     DATE         NOT NULL,
    estado          estado_turno NOT NULL DEFAULT 'pendiente',
    hora_cumplido   TIMESTAMPTZ,
    observaciones   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (parcela_id, fecha_turno)
);

COMMENT ON TABLE turnos_riego IS 'RF1: Una parcela = un responsable por día. Registra hora exacta al cumplir.';

-- ============================================================
-- TABLA: cosechas
-- RF3: Registro de recolecciones
-- ============================================================

CREATE TABLE cosechas (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    siembra_id      UUID           NOT NULL REFERENCES siembras(id),
    vecino_id       UUID           NOT NULL REFERENCES vecinos(id),
    fecha_cosecha   DATE           NOT NULL DEFAULT CURRENT_DATE,
    cantidad_kg     NUMERIC(8,3)   NOT NULL CHECK (cantidad_kg > 0),
    estado          estado_cosecha NOT NULL DEFAULT 'registrada',
    notas           TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: distribuciones_cosecha
-- ============================================================

CREATE TABLE distribuciones_cosecha (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    cosecha_id      UUID         NOT NULL REFERENCES cosechas(id),
    vecino_id       UUID         NOT NULL REFERENCES vecinos(id),
    cantidad_kg     NUMERIC(8,3) NOT NULL CHECK (cantidad_kg > 0),
    recibido        BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_entrega   DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (cosecha_id, vecino_id)
);

-- ============================================================
-- TABLA: actividad_vecinos (métricas para ranking)
-- RF5: Datos del dashboard de rendición de cuentas
-- ============================================================

CREATE TABLE actividad_vecinos (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    vecino_id           UUID         NOT NULL REFERENCES vecinos(id),
    anio                SMALLINT     NOT NULL,
    mes                 SMALLINT     NOT NULL CHECK (mes BETWEEN 1 AND 12),
    turnos_asignados    SMALLINT     NOT NULL DEFAULT 0,
    turnos_cumplidos    SMALLINT     NOT NULL DEFAULT 0,
    turnos_incumplidos  SMALLINT     NOT NULL DEFAULT 0,
    cosechas_reportadas SMALLINT     NOT NULL DEFAULT 0,
    kg_cosechados       NUMERIC(8,3) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (vecino_id, anio, mes)
);

-- ============================================================
-- TABLA: mensajes_chat (reemplaza el WhatsApp caótico)
-- ============================================================

CREATE TABLE mensajes_chat (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vecino_id   UUID        NOT NULL REFERENCES vecinos(id),
    texto       TEXT        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mensajes_chat IS 'Chat comunitario persistente. Reemplaza los 300 mensajes diarios de WhatsApp.';

-- ============================================================
-- TABLA: notificaciones
-- ============================================================

CREATE TABLE notificaciones (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vecino_id   UUID        REFERENCES vecinos(id), -- NULL = para todos
    titulo      VARCHAR(100) NOT NULL,
    cuerpo      TEXT        NOT NULL,
    leida       BOOLEAN     NOT NULL DEFAULT FALSE,
    tipo        tipo_notif  NOT NULL DEFAULT 'info',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notificaciones IS 'Avisos a vecinos. vecino_id NULL = aviso global para todos.';

-- ============================================================
--  ÍNDICES de optimización
-- ============================================================

CREATE INDEX idx_turnos_fecha      ON turnos_riego (fecha_turno);
CREATE INDEX idx_turnos_vecino     ON turnos_riego (vecino_id);
CREATE INDEX idx_turnos_estado     ON turnos_riego (estado);
CREATE INDEX idx_cosechas_fecha    ON cosechas (fecha_cosecha);
CREATE INDEX idx_cosechas_siembra  ON cosechas (siembra_id);
CREATE INDEX idx_siembras_parcela  ON siembras (parcela_id);
CREATE INDEX idx_actividad_mes     ON actividad_vecinos (anio, mes);
CREATE INDEX idx_chat_created      ON mensajes_chat (created_at DESC);
CREATE INDEX idx_notif_vecino      ON notificaciones (vecino_id, leida);
CREATE INDEX idx_vecinos_email     ON vecinos (email);

-- ============================================================
--  VISTAS para el Dashboard Comunitario
-- ============================================================

CREATE OR REPLACE VIEW v_riego_hoy AS
SELECT
    tr.id,
    p.codigo                            AS parcela,
    p.descripcion                       AS descripcion_parcela,
    v.nombre || ' ' || v.apellido       AS responsable,
    tr.estado,
    tr.hora_cumplido
FROM turnos_riego tr
JOIN parcelas p ON p.id = tr.parcela_id
JOIN vecinos  v ON v.id = tr.vecino_id
WHERE tr.fecha_turno = CURRENT_DATE;

CREATE OR REPLACE VIEW v_cosechas_mes AS
SELECT
    c.id,
    e.nombre_comun                      AS especie,
    p.codigo                            AS parcela,
    v.nombre || ' ' || v.apellido       AS cosechador,
    c.fecha_cosecha,
    c.cantidad_kg,
    c.estado
FROM cosechas c
JOIN siembras s  ON s.id = c.siembra_id
JOIN especies e  ON e.id = s.especie_id
JOIN parcelas p  ON p.id = s.parcela_id
JOIN vecinos  v  ON v.id = c.vecino_id
WHERE DATE_TRUNC('month', c.fecha_cosecha) = DATE_TRUNC('month', CURRENT_DATE);

CREATE OR REPLACE VIEW v_ranking_vecinos AS
SELECT
    v.id                                AS vecino_id,
    v.nombre || ' ' || v.apellido       AS vecino,
    av.anio,
    av.mes,
    av.turnos_asignados,
    av.turnos_cumplidos,
    av.turnos_incumplidos,
    av.cosechas_reportadas,
    av.kg_cosechados,
    CASE
        WHEN av.turnos_asignados = 0 THEN 0
        ELSE ROUND((av.turnos_cumplidos::NUMERIC / av.turnos_asignados) * 100, 1)
    END                                 AS pct_cumplimiento
FROM actividad_vecinos av
JOIN vecinos v ON v.id = av.vecino_id
ORDER BY pct_cumplimiento DESC, av.kg_cosechados DESC;

-- ============================================================
--  DML - DATOS DE PRUEBA
--  IMPORTANTE: Las contraseñas son hash bcrypt de "1234"
--  Todos los vecinos pueden entrar con su email + "1234"
-- ============================================================

-- ── VECINOS (18) ────────────────────────────────────────────
-- Hash bcrypt de "1234" generado con saltRounds=10
-- Todos usan la misma password "1234" para facilitar pruebas
INSERT INTO vecinos (id, nombre, apellido, telefono, email, password_hash, rol) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Carmen',    'Fuentes',   '+56911111111', 'carmen@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'coordinador'),
    ('a0000000-0000-0000-0000-000000000002', 'José',      'Ramírez',   '+56922222222', 'jose@huerto.cl',      '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000003', 'María',     'González',  '+56933333333', 'maria@huerto.cl',     '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000004', 'Luis',      'Herrera',   '+56944444444', 'luis@huerto.cl',      '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000005', 'Ana',       'Vargas',    '+56955555555', 'ana@huerto.cl',       '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000006', 'Pedro',     'Muñoz',     '+56966666666', 'pedro@huerto.cl',     '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000007', 'Sofía',     'Torres',    '+56977777777', 'sofia@huerto.cl',     '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000008', 'Carlos',    'Flores',    '+56988888888', 'carlos@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000009', 'Lucía',     'Reyes',     '+56999999999', 'lucia@huerto.cl',     '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000010', 'Roberto',   'Castro',    '+56910000000', 'roberto@huerto.cl',   '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000011', 'Valentina', 'Morales',   '+56911000001', 'valentina@huerto.cl', '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000012', 'Diego',     'Rojas',     '+56911000002', 'diego@huerto.cl',     '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000013', 'Isabel',    'Navarro',   '+56911000003', 'isabel@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000014', 'Andrés',    'Jiménez',   '+56911000004', 'andres@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000015', 'Fernanda',  'Díaz',      '+56911000005', 'fernanda@huerto.cl',  '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000016', 'Miguel',    'Álvarez',   '+56911000006', 'miguel@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000017', 'Catalina',  'Soto',      '+56911000007', 'catalina@huerto.cl',  '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro'),
    ('a0000000-0000-0000-0000-000000000018', 'Marcos',    'Vega',      '+56911000008', 'marcos@huerto.cl',    '$2a$10$DKwSZ6XAGAlBpUKsAyqzWePz6vGhBVjW4nKZ0wPCsUbVjcfGyJM5G', 'miembro');

-- ── PARCELAS (grilla 6x3 = 18 parcelas) ─────────────────────
INSERT INTO parcelas (codigo, descripcion, area_m2, estado, ubicacion_fila, ubicacion_col) VALUES
    ('P-01', 'Zona norte, lado izquierdo',   4.0, 'ocupada',     1, 1),
    ('P-02', 'Zona norte, centro',           4.0, 'ocupada',     1, 2),
    ('P-03', 'Zona norte, lado derecho',     4.0, 'disponible',  1, 3),
    ('P-04', 'Segunda fila, izquierda',      4.0, 'ocupada',     2, 1),
    ('P-05', 'Segunda fila, centro',         4.0, 'ocupada',     2, 2),
    ('P-06', 'Segunda fila, derecha',        4.0, 'disponible',  2, 3),
    ('P-07', 'Tercera fila, izquierda',      4.0, 'ocupada',     3, 1),
    ('P-08', 'Tercera fila, centro',         4.0, 'en_descanso', 3, 2),
    ('P-09', 'Tercera fila, derecha',        4.0, 'disponible',  3, 3),
    ('P-10', 'Cuarta fila, izquierda',       4.0, 'ocupada',     4, 1),
    ('P-11', 'Cuarta fila, centro',          4.0, 'disponible',  4, 2),
    ('P-12', 'Cuarta fila, derecha',         4.0, 'ocupada',     4, 3),
    ('P-13', 'Quinta fila, izquierda',       4.0, 'disponible',  5, 1),
    ('P-14', 'Quinta fila, centro',          4.0, 'ocupada',     5, 2),
    ('P-15', 'Quinta fila, derecha',         4.0, 'disponible',  5, 3),
    ('P-16', 'Zona sur, izquierda',          4.0, 'ocupada',     6, 1),
    ('P-17', 'Zona sur, centro',             4.0, 'disponible',  6, 2),
    ('P-18', 'Zona sur, derecha',            4.0, 'disponible',  6, 3);

-- ── ESPECIES ────────────────────────────────────────────────
INSERT INTO especies (nombre_comun, nombre_cientifico, dias_cosecha, notas) VALUES
    ('Lechuga',    'Lactuca sativa',         45,  'Riego diario. Evitar exceso de sol directo.'),
    ('Tomate',     'Solanum lycopersicum',   80,  'Requiere tutor. Riego cada 2 días en verano.'),
    ('Zanahoria',  'Daucus carota',          90,  'Suelo suelto y profundo. Riego moderado.'),
    ('Cilantro',   'Coriandrum sativum',     30,  'Cosecha antes de que florezca.'),
    ('Espinaca',   'Spinacia oleracea',      40,  'Ideal para temporada fría.'),
    ('Albahaca',   'Ocimum basilicum',       28,  'Alta demanda de agua. Luz solar directa.'),
    ('Pepino',     'Cucumis sativus',        55,  'Riego constante. Necesita espacio vertical.'),
    ('Rabanito',   'Raphanus sativus',       25,  'Cultivo rápido, ideal para rotación.');

-- ── SIEMBRAS ────────────────────────────────────────────────
INSERT INTO siembras (parcela_id, especie_id, vecino_id, fecha_siembra, fecha_cosecha_estimada, cantidad_plantas, activa)
SELECT
    p.id, e.id, v.id,
    s.fecha_siembra,
    s.fecha_siembra + (e.dias_cosecha || ' days')::INTERVAL,
    s.plantas,
    TRUE
FROM (VALUES
    ('P-01', 'Lechuga',   'Carmen',  '2025-04-01'::DATE, 8),
    ('P-02', 'Tomate',    'José',    '2025-04-03'::DATE, 4),
    ('P-04', 'Zanahoria', 'María',   '2025-04-05'::DATE, 20),
    ('P-05', 'Cilantro',  'Luis',    '2025-04-10'::DATE, 15),
    ('P-07', 'Espinaca',  'Ana',     '2025-04-12'::DATE, 12),
    ('P-10', 'Albahaca',  'Pedro',   '2025-04-15'::DATE, 6),
    ('P-12', 'Pepino',    'Sofía',   '2025-04-18'::DATE, 3),
    ('P-14', 'Rabanito',  'Carlos',  '2025-04-20'::DATE, 30),
    ('P-16', 'Tomate',    'Lucía',   '2025-04-22'::DATE, 5)
) AS s(parcela_cod, especie_nom, vecino_nom, fecha_siembra, plantas)
JOIN parcelas p ON p.codigo = s.parcela_cod
JOIN especies e ON e.nombre_comun = s.especie_nom
JOIN vecinos  v ON v.nombre = s.vecino_nom;

-- ── TURNOS DE RIEGO (últimos 7 días + hoy) ──────────────────
INSERT INTO turnos_riego (parcela_id, vecino_id, fecha_turno, estado, hora_cumplido)
SELECT
    p.id, v.id, t.fecha, t.estado::estado_turno,
    CASE WHEN t.estado = 'cumplido'
         THEN (t.fecha::TIMESTAMPTZ + INTERVAL '18 hours')
         ELSE NULL
    END
FROM (VALUES
    ('P-01', 'Carmen',    CURRENT_DATE - 6, 'cumplido'),
    ('P-02', 'José',      CURRENT_DATE - 6, 'cumplido'),
    ('P-04', 'María',     CURRENT_DATE - 6, 'cumplido'),
    ('P-01', 'Luis',      CURRENT_DATE - 5, 'cumplido'),
    ('P-02', 'Ana',       CURRENT_DATE - 5, 'incumplido'),
    ('P-04', 'Pedro',     CURRENT_DATE - 5, 'cumplido'),
    ('P-01', 'Sofía',     CURRENT_DATE - 4, 'cumplido'),
    ('P-02', 'Carlos',    CURRENT_DATE - 4, 'cumplido'),
    ('P-04', 'Lucía',     CURRENT_DATE - 4, 'incumplido'),
    ('P-01', 'Roberto',   CURRENT_DATE - 3, 'cumplido'),
    ('P-02', 'Valentina', CURRENT_DATE - 3, 'incumplido'),
    ('P-04', 'Diego',     CURRENT_DATE - 3, 'cumplido'),
    ('P-01', 'Isabel',    CURRENT_DATE - 2, 'cumplido'),
    ('P-02', 'Andrés',    CURRENT_DATE - 2, 'cumplido'),
    ('P-04', 'Fernanda',  CURRENT_DATE - 2, 'cumplido'),
    ('P-01', 'Miguel',    CURRENT_DATE - 1, 'cumplido'),
    ('P-02', 'Catalina',  CURRENT_DATE - 1, 'cumplido'),
    ('P-04', 'Marcos',    CURRENT_DATE - 1, 'incumplido'),
    -- TURNOS DE HOY (pendientes para que los vecinos los marquen)
    ('P-01', 'Carmen',    CURRENT_DATE,     'pendiente'),
    ('P-02', 'José',      CURRENT_DATE,     'pendiente'),
    ('P-04', 'María',     CURRENT_DATE,     'pendiente'),
    ('P-05', 'Luis',      CURRENT_DATE,     'pendiente'),
    ('P-07', 'Ana',       CURRENT_DATE,     'pendiente'),
    ('P-10', 'Pedro',     CURRENT_DATE,     'cumplido'),
    ('P-12', 'Sofía',     CURRENT_DATE,     'pendiente'),
    ('P-14', 'Carlos',    CURRENT_DATE,     'cumplido'),
    ('P-16', 'Lucía',     CURRENT_DATE,     'pendiente'),
    -- PRÓXIMOS DÍAS
    ('P-01', 'Luis',      CURRENT_DATE + 1, 'pendiente'),
    ('P-02', 'Sofía',     CURRENT_DATE + 1, 'pendiente'),
    ('P-04', 'Carlos',    CURRENT_DATE + 1, 'pendiente'),
    ('P-01', 'Pedro',     CURRENT_DATE + 2, 'pendiente'),
    ('P-02', 'Ana',       CURRENT_DATE + 2, 'pendiente')
) AS t(parcela_cod, vecino_nom, fecha, estado)
JOIN parcelas p ON p.codigo = t.parcela_cod
JOIN vecinos  v ON v.nombre = t.vecino_nom;

-- ── COSECHAS ────────────────────────────────────────────────
INSERT INTO cosechas (siembra_id, vecino_id, fecha_cosecha, cantidad_kg, estado)
SELECT
    s.id, v.id, c.fecha, c.kg, c.estado::estado_cosecha
FROM (VALUES
    ('Lechuga',   'Carmen',  CURRENT_DATE - 10, 2.5,  'distribuida'),
    ('Lechuga',   'Carmen',  CURRENT_DATE - 3,  1.8,  'registrada'),
    ('Cilantro',  'Luis',    CURRENT_DATE - 8,  0.5,  'distribuida'),
    ('Rabanito',  'Carlos',  CURRENT_DATE - 5,  3.2,  'distribuida'),
    ('Albahaca',  'Pedro',   CURRENT_DATE - 2,  0.3,  'registrada'),
    ('Espinaca',  'Ana',     CURRENT_DATE - 1,  1.1,  'registrada')
) AS c(especie_nom, vecino_nom, fecha, kg, estado)
JOIN especies e ON e.nombre_comun = c.especie_nom
JOIN siembras s ON s.especie_id = e.id
JOIN vecinos  v ON v.nombre = c.vecino_nom;

-- ── DISTRIBUCIONES (reparto equitativo para cosechas distribuidas) ──
INSERT INTO distribuciones_cosecha (cosecha_id, vecino_id, cantidad_kg, recibido, fecha_entrega)
SELECT
    c.id,
    v.id,
    ROUND(c.cantidad_kg / 18.0, 3),
    TRUE,
    c.fecha_cosecha + 1
FROM cosechas c
CROSS JOIN vecinos v
WHERE c.estado = 'distribuida';

-- ── ACTIVIDAD MENSUAL (para el ranking) ─────────────────────
INSERT INTO actividad_vecinos (vecino_id, anio, mes, turnos_asignados, turnos_cumplidos, turnos_incumplidos, cosechas_reportadas, kg_cosechados)
SELECT
    v.id,
    EXTRACT(YEAR  FROM CURRENT_DATE)::SMALLINT,
    EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT,
    s.asignados, s.cumplidos, s.incumplidos, s.cosechas, s.kg
FROM (VALUES
    ('Carmen',    6, 5, 1, 2, 4.3),
    ('Carlos',    2, 2, 0, 1, 3.2),
    ('José',      4, 4, 0, 0, 0.0),
    ('María',     4, 3, 1, 0, 0.0),
    ('Luis',      3, 3, 0, 1, 0.5),
    ('Pedro',     3, 3, 0, 1, 0.3),
    ('Ana',       3, 2, 1, 1, 1.1),
    ('Sofía',     3, 2, 1, 0, 0.0),
    ('Roberto',   2, 2, 0, 0, 0.0),
    ('Diego',     2, 2, 0, 0, 0.0),
    ('Isabel',    2, 2, 0, 0, 0.0),
    ('Andrés',    2, 2, 0, 0, 0.0),
    ('Fernanda',  2, 2, 0, 0, 0.0),
    ('Miguel',    2, 2, 0, 0, 0.0),
    ('Catalina',  2, 2, 0, 0, 0.0),
    ('Lucía',     3, 1, 2, 0, 0.0),
    ('Valentina', 2, 1, 1, 0, 0.0),
    ('Marcos',    2, 1, 1, 0, 0.0)
) AS s(nombre, asignados, cumplidos, incumplidos, cosechas, kg)
JOIN vecinos v ON v.nombre = s.nombre;

-- ── MENSAJES DEL CHAT ───────────────────────────────────────
INSERT INTO mensajes_chat (vecino_id, texto, created_at)
SELECT v.id, m.texto, NOW() - (m.hace_horas || ' hours')::INTERVAL
FROM (VALUES
    ('Carmen', '¡Hola a todos! ¿Alguien va a regar esta tarde? Me ha surgido un imprevisto y no podré pasar por mi parcela.', 5),
    ('Miguel', 'Yo estaré por allí sobre las 18:00, Carmen. Te riego los tomates y las lechugas, no te preocupes 🌿', 4),
    ('Carmen', '¡Gracias Miguel! Por cierto, he dejado unos esquejes de romero en la mesa común por si alguien quiere.', 3),
    ('Diego',  'Anotado. ¡Llevaré herramientas extra por si hacen falta!', 2),
    ('Ana',    'Recuerden: mañana es el día de limpieza comunitaria a las 10:00 AM.', 1)
) AS m(nombre, texto, hace_horas)
JOIN vecinos v ON v.nombre = m.nombre;

-- ── NOTIFICACIONES GLOBALES ─────────────────────────────────
INSERT INTO notificaciones (vecino_id, titulo, cuerpo, tipo) VALUES
    (NULL, 'Turno de riego mañana',  'Recuerda que mañana es tu turno de riego. ¡No olvides marcarlo cuando termines!', 'riego'),
    (NULL, 'Cosecha disponible',     'Carmen reportó 2.5kg de lechuga lista para distribuir entre la comunidad.',       'cosecha'),
    (NULL, 'Reunión comunitaria',    'Este sábado a las 10:00 AM en el huerto. Tema: planificación de temporada.',      'alerta'),
    (NULL, 'Bienvenidos al sistema', 'Ya no más caos en WhatsApp — ahora todos los registros quedan guardados aquí.',   'info');

-- ============================================================
--  CONSULTAS DE VERIFICACIÓN
-- ============================================================

-- ¿Cuántos registros hay en cada tabla?
SELECT
    (SELECT COUNT(*) FROM vecinos)               AS vecinos,
    (SELECT COUNT(*) FROM parcelas)              AS parcelas,
    (SELECT COUNT(*) FROM especies)              AS especies,
    (SELECT COUNT(*) FROM siembras)              AS siembras,
    (SELECT COUNT(*) FROM turnos_riego)          AS turnos,
    (SELECT COUNT(*) FROM cosechas)              AS cosechas,
    (SELECT COUNT(*) FROM distribuciones_cosecha) AS distribuciones,
    (SELECT COUNT(*) FROM actividad_vecinos)     AS actividades,
    (SELECT COUNT(*) FROM mensajes_chat)         AS mensajes,
    (SELECT COUNT(*) FROM notificaciones)        AS notificaciones;

-- ============================================================
--  CREDENCIALES PARA PROBAR EL LOGIN
-- ============================================================
-- Email: carmen@huerto.cl    (Coordinadora)
-- Email: jose@huerto.cl      (Miembro)
-- Email: maria@huerto.cl     (Miembro)
-- ... (cualquier email de la tabla vecinos)
-- 
-- Contraseña para TODOS: 1234
-- ============================================================
