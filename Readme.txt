# 🌱 Huerto Vivo — Sistema de Gestión Comunitaria

## Requisitos
- Node.js 18+
- PostgreSQL 18
- pgAdmin (para ejecutar el script SQL)

## Instalación

### 1. Base de datos
- Abrir pgAdmin
- Crear base de datos llamada `huerto_db`
- Ejecutar el archivo `db/huerto_db_completa.sql`

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tu contraseña de PostgreSQL
npm run dev
```

### 3. Frontend
```bash
cd frontend/huerto-frontend-v3
npm install
npm run dev
```

## Credenciales de prueba
| Email | Rol | Contraseña |
|---|---|---|
| carmen@huerto.cl | Coordinadora | 1234 |
| jose@huerto.cl | Miembro | 1234 |

## URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health check: http://localhost:3000/health