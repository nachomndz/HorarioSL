# HorarioSL

Generador de horarios escolares para colegios. Aplicación Next.js desplegable en Vercel con Supabase.

## Funcionalidades

- **Multi-admin**: varios administradores por colegio (con Supabase)
- **Malla horaria configurable**: días, horarios, duración de sesiones y recreos
- **14 cursos**: plantilla 3+6+4+1 (Infantil, Primaria, Secundaria, Diversificación), totalmente editable
- **Asignaturas y matriz de horas** por curso
- **Profesores** con horas máximas, asignaturas, ciclos/cursos y disponibilidad
- **Generador automático** de horarios (motor CSP en el navegador)
- **Edición drag-and-drop** de sesiones
- **Exportación a Excel** con hoja por profesor y por curso
- **Sugerencias de mejora** persistentes

## Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com) (producción)
- Cuenta en [Vercel](https://vercel.com) (despliegue)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Por defecto usa **modo local** (`NEXT_PUBLIC_DATA_SOURCE=local`): datos en `localStorage`, sin Supabase.

## Producción con Supabase

### 1. Base de datos

1. Crea un proyecto en Supabase
2. Ejecuta en el SQL Editor:
   - Proyecto nuevo: [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
   - BD existente con schema antiguo: también [`supabase/migrations/002_four_cycles.sql`](supabase/migrations/002_four_cycles.sql)
3. En Auth → Email: desactiva confirmación de email (o confirma usuarios manualmente)

### 2. Variables de entorno

En `.env.local` (local) o Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

**Seguridad:** nunca subas claves al repositorio. Si una clave se expone, rótala en Supabase Dashboard → Settings → API.

### 3. Despliegue en Vercel

1. Sube el código a GitHub
2. Importa el repo en [vercel.com/new](https://vercel.com/new)
3. Añade las variables de entorno anteriores
4. Deploy

## Flujo de uso

1. Configurar **malla horaria**
2. Revisar **cursos** y **asignaturas** (matriz de horas)
3. Añadir **profesores** con restricciones
4. **Generar horario** y ajustar con drag-and-drop
5. **Publicar** y **descargar Excel**

## Estructura

```
src/app/              # Rutas Next.js
src/components/       # UI, horarios, landing
src/lib/              # Supabase, solver CSP, Excel
supabase/migrations/  # Esquema PostgreSQL + RLS
```

## Licencia

Privado — uso del colegio.
