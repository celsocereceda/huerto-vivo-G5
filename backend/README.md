# 🌱 Huerto Comunitario — Backend API

Backend completo en **Node.js + Express + TypeScript + PostgreSQL** para el sistema del huerto comunitario.

---

## ⚡ Instalación en 4 pasos

### 1️⃣  Asegúrate de tener la base de datos lista

Antes de correr el backend debes haber ejecutado `huerto_db_completa.sql` en pgAdmin (Query Tool sobre la base `huerto_db`).

### 2️⃣  Instalar dependencias

```bash
cd backend
npm install
```

### 3️⃣  Configurar el archivo `.env`

Copia el ejemplo:

```bash
copy .env.example .env
```

Edita `.env` y reemplaza `TUPASSWORD` por la contraseña real de tu usuario `postgres`:

```env
DATABASE_URL=postgresql://postgres:1234@localhost:5432/huerto_db
JWT_SECRET=cambia_esto_por_un_secreto_largo
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4️⃣  Iniciar el servidor

```bash
npm run dev
```

Deberías ver:

```
✅ Base de datos conectada correctamente

╔════════════════════════════════════════════╗
║   🌱  Huerto Comunitario API  🌱           ║
║   Corriendo en  http://localhost:3000      ║
╚════════════════════════════════════════════╝
```

---

## 🧪 Verificar que todo funciona

Abre estas URLs en tu navegador con el servidor corriendo:

| URL | Qué debería mostrar |
|---|---|
| http://localhost:3000/health | `{"ok":true,"status":"online"}` |
| http://localhost:3000/api/dashboard | Error 401 (sin token) → ¡es correcto, está protegido! |

---

## 🔐 Credenciales de prueba (vienen en la BD)

**Todos los vecinos usan la misma contraseña para facilitar las pruebas:**

| Email | Rol | Contraseña |
|---|---|---|
| `carmen@huerto.cl` | Coordinadora | `1234` |
| `jose@huerto.cl` | Miembro | `1234` |
| *(cualquier email de la tabla vecinos)* | Miembro | `1234` |

---

## 📡 Endpoints disponibles

### 🔓 Públicos (sin token)
- `POST /api/auth/login` — Iniciar sesión
- `POST /api/auth/register` — Crear cuenta
- `GET  /health` — Estado del servidor

### 🔒 Protegidos (requieren `Authorization: Bearer <token>`)

**Dashboard**
- `GET /api/dashboard` — Datos del panel principal
- `GET /api/dashboard/ranking?anio=2025&mes=5` — Ranking
- `GET /api/dashboard/especies` — Catálogo de cultivos

**Vecinos**
- `GET /api/vecinos` — Lista
- `GET /api/vecinos/:id` — Detalle

**Parcelas**
- `GET /api/parcelas` — Lista completa
- `GET /api/parcelas/disponibles` — Solo libres

**Siembras**
- `GET    /api/siembras` — Lista
- `POST   /api/siembras` — Registrar nueva (cualquier vecino)
- `DELETE /api/siembras/:id` — Finalizar (solo coordinador)

**Turnos de Riego**
- `GET   /api/turnos/hoy` — Turnos de hoy
- `GET   /api/turnos/proximos` — Próximos 7 días
- `GET   /api/turnos` — Con filtros `?fecha=&estado=`
- `POST  /api/turnos` — Asignar (solo coordinador)
- `PATCH /api/turnos/:id/cumplir` — ✅ "Ya regué hoy"

**Cosechas**
- `GET  /api/cosechas/mes-actual` — Resumen del mes
- `GET  /api/cosechas` — Lista
- `POST /api/cosechas` — Reportar nueva
- `POST /api/cosechas/:id/distribuir` — Repartir entre vecinos

**Chat Comunitario**
- `GET    /api/chat` — Mensajes (últimos 100)
- `POST   /api/chat` — Enviar mensaje
- `DELETE /api/chat/:id` — Eliminar (propio o coordinador)

**Notificaciones**
- `GET   /api/notificaciones` — Mis notificaciones
- `PATCH /api/notificaciones/:id/leer` — Marcar como leída
- `PATCH /api/notificaciones/leer-todas` — Marcar todas
- `POST  /api/notificaciones` — Crear aviso global (solo coordinador)

---

## 🛠️ Solución de problemas

### `db_error` al entrar a /health
- Verifica que PostgreSQL esté corriendo (Servicios → postgresql-x64-18)
- Confirma que la contraseña del `.env` sea correcta
- Asegúrate que la base `huerto_db` existe y tiene las tablas

### `npm install` falla
- Asegúrate de tener Node.js 18+ instalado: `node --version`

### El frontend no se conecta
- El backend debe estar en el puerto 3000
- Verifica el proxy en `vite.config.js` del frontend

---

## 📂 Estructura del proyecto

```
backend/
├── src/
│   ├── index.ts              ← Servidor Express
│   ├── db.ts                 ← Conexión PostgreSQL
│   ├── middleware/
│   │   └── auth.ts           ← JWT + control de roles
│   └── routes/
│       ├── auth.ts           ← Login / Registro
│       ├── vecinos.ts
│       ├── parcelas.ts
│       ├── siembras.ts
│       ├── turnos.ts
│       ├── cosechas.ts
│       ├── chat.ts
│       ├── notificaciones.ts
│       └── dashboard.ts
├── .env                      ← Tu configuración (NO subir a git)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```
