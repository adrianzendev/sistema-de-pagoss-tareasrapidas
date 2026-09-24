# TR Pagos — Sistema de pagos de Tareas Rápidas

Aplicación full-stack en TypeScript: React + Vite + Tailwind + shadcn/ui en `client/`, Express en `server/`, esquema Drizzle compartido en `shared/`. Base de datos PostgreSQL (Neon). Tres roles: **admin**, **tutor** y **verificador**, cada uno con sus vistas en `client/src/pages/<rol>/`.

## Comandos

```bash
npm run dev       # desarrollo (Vite + Express) en http://localhost:5000
npm run build     # compila frontend (dist/public) y servidor (dist/index.cjs)
npm run start     # producción (lo usa Railway)
npm run db:push   # sincroniza el esquema de shared/schema.ts con la base
```

- Las variables se leen de `.env` con `--env-file-if-exists` (en Railway, desde el panel). Necesarias: `DATABASE_URL`, `SESSION_SECRET`. `.env` nunca se sube a Git.
- El servidor **no** modifica la base al arrancar (el seed de `server/seed.ts` está desconectado).
- En desarrollo, el login muestra "Accesos Rápidos" (ruta `/api/dev/users`, solo si `NODE_ENV !== "production"`).

## Contraseñas (OBLIGATORIO)

Toda la lógica vive en `server/utils/password.ts` (`DEFAULT_TUTOR_PASSWORD`, `hashPassword`, `parseNewPassword`). No duplicarla.

- **Tutores nuevos:** contraseña por defecto **`123456`**, salvo que el admin escriba otra en el modal "Crear tutor". `POST /api/admin/tutors` usa `parseNewPassword(password) ?? DEFAULT_TUTOR_PASSWORD` y siempre la cifra.
- **Cifrado:** siempre con `hashPassword()` (bcrypt, 10 rondas). Nunca llamar a `bcrypt.hash` directamente ni guardar texto plano en la base.
- **Edición desde el modal** (`PATCH /api/admin/tutors/:id` y `/verifiers/:id`): la contraseña solo cambia si el campo trae texto. `parseNewPassword` la recorta; vacía = no se cambia; menos de 6 caracteres = HTTP 400; si es válida, se cifra con `hashPassword` y se actualiza. El frontend solo envía `password` si el campo tiene texto.
- **Mínimo 6 caracteres** en todos los formularios (crear/editar tutor y verificador), igual que en el servidor.
- **Verificadores:** al crearlos la contraseña es obligatoria (la regla del 123456 es solo para tutores).
- **Nunca exponer contraseñas:** quitar `password` de toda respuesta (`const { password, ...safe } = user`) y no escribirla en logs.
- **Login:** `bcrypt.compare`; acepta usuario o correo, el correo sin distinguir mayúsculas (`storage.getUserByEmail` compara `lower(email)`).
- **Cambios manuales en producción:** script temporal **fuera del repositorio**, con la contraseña pasada por variable de entorno y `hashPassword`; verificar con `bcrypt.compare` y borrar el script al terminar.
- **Seed:** `server/seed.ts` está desconectado; no volver a llamarlo al arrancar (pondría `123456` a todos los usuarios).

## Sistema de diseño: Flat Outlined + rejilla 4/8 puntos (OBLIGATORIO)

Toda vista o componente nuevo o modificado debe cumplir estas reglas. Los tokens viven en `client/src/index.css` y `tailwind.config.ts`; los componentes base en `client/src/components/ui/`.

### Flat Outlined (contorno puro)
- **Todo sobre blanco, sin rellenos de color.** En tema claro, todas las superficies son blancas (`background`, `card`, `popover` y `sidebar` = `0 0% 100%`). El color se expresa **solo con borde y texto**, nunca con fondo.
  - Prohibido en pantallas y componentes: `bg-primary`, `bg-success`, `bg-destructive`, `bg-warning` (sólidos o con opacidad: `bg-success/10`, `bg-primary/5`…) y fondos grises fijos (`bg-muted`, `bg-secondary`, `bg-muted/30`…).
  - Correcto: `border border-success/40 text-success` (estado), `border border-primary/30` (caja destacada), `border border-border` (caja neutra).
- **Botones sin relleno:** todas las variantes de `ui/button.tsx` son de contorno. `default` = borde y texto `primary`; `destructive` = borde y texto `destructive`; `secondary`/`outline` = borde `border`. Nunca `bg-primary` ni `text-primary-foreground` en un botón.
- **Badges sin relleno:** variantes de `ui/badge.tsx` con fondo blanco, borde del tono al 40 % y texto del tono (`border-success/40 text-success`). Nunca `border-0`.
- **Hover y foco:** solo gris neutro muy claro (`hover:bg-accent`, `hover:bg-muted/40`, `focus:bg-accent`) o el efecto `hover-elevate`. Nunca hover de color (`hover:bg-success/20`).
- **Sin sombras.** Las clases `shadow-*` están mapeadas a variables `--shadow-*` que valen `0 0 #0000`. No usar sombras arbitrarias (`shadow-[...]`).
- **Bordes definidos de 1 px** con tokens: `border border-border` (claro `220 13% 85%`, oscuro `220 13% 24%`). Tarjetas, inputs, selects, modales, menús, badges, botones y cajas llevan borde. Bordes de color al 30–40 % (nunca `/10`–`/20`, no se ven sin fondo).
- **Solo tokens de color:** `primary`, `muted-foreground`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `sidebar-*`. Prohibido `text-red-500`, `bg-blue-600`, `border-gray-300`, degradados, etc.
- **Navegación: estado activo sin borde.** El `border` se reserva para contenedores (tarjetas, modales, tablas, cajas, inputs, botones de acción y el divisor `border-r` del sidebar). Los ítems de navegación (menú del sidebar, subítems, pestañas, toggles, paginación) **no llevan borde** en ningún estado:
  - Activo: fondo plano sutil + texto/ícono primario → `bg-accent text-primary font-medium` (en el sidebar `bg-sidebar-accent`). Es la única excepción a "sin fondos": un gris neutro, nunca un color.
  - Hover: el mismo gris más suave → `hover:bg-accent/60` (sidebar `hover:bg-sidebar-accent/60`).
  - Inactivo: `text-muted-foreground`, sin fondo.
  - Nada de subrayados (`border-b-2`) ni contornos para marcar la pestaña activa.
  - Definido en `ui/sidebar.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx` y `ui/pagination.tsx`; las pestañas hechas a mano (p. ej. `admin/tutor-view.tsx`) usan las mismas clases.
- **Sidebar:** fondo blanco y borde derecho `border-sidebar-border`; los ítems siguen la regla de navegación de arriba.
- **Controles:** checkbox marcado = borde y check `primary` sobre blanco; switch = pista blanca con borde (`primary` al activarse) y punto de color.
- **Excepciones permitidas:** el oscurecido detrás de los modales (`bg-black/80`), las barras de progreso y gráficos (el relleno *es* el dato), los placeholders de carga (`animate-pulse`, `ui/skeleton.tsx`), el punto del switch y los colores que son datos (p. ej. el color blanco/negro de una moneda).

### Rejilla 4/8 puntos
- **Solo la escala de Tailwind** (1 = 4 px). Prohibido `.5` (`p-1.5`, `gap-2.5`, `h-3.5`…) y valores arbitrarios en px (`p-[5px]`, `h-[18px]`), salvo líneas de 1–2 px y anchos fijos múltiplos de 4.
- **Layout (pasos de 8 px):** `main` con `p-4 sm:p-6` (en `App.tsx`); secciones de cada pantalla con `space-y-6`; grids de tarjetas con `gap-4`.
- **Ajustes internos (pasos de 4 px):** `1` y `3` solo dentro de elementos compactos (ícono–texto, badges, celdas).
- **Tarjetas:** relleno por defecto `p-6`; KPI con `<CardContent className="pt-6">`; tabla dentro de tarjeta con `<CardContent className="p-0">`.
- **Tablas (compactas):** encabezado `h-10 px-4`, celda `px-4 py-3`, definidos en `ui/table.tsx`. **No sobrescribir** el relleno de `TableHead`/`TableCell` en las pantallas; solo las filas auxiliares (separadores de semana, detalle anidado) usan `py-2`.
- **Controles:** alturas 32 / 40 / 48 px (`size="sm"` / normal / `size="lg"`); inputs y selects 40 px; botón de ícono 40 × 40.
- **Íconos:** 12 / 16 / 20 px (`h-3`, `h-4`, `h-5`).
- **Texto:** mínimo `text-xs` (12 px). Prohibido `text-[Npx]`.
- **Radios:** `rounded-sm` 4 px, `rounded-md` 8 px, `rounded-lg` 12 px, `rounded-xl` 16 px.

### shadcn/ui
- Configurado en `components.json` (estilo `new-york`, alias `@/components/ui`). Para agregar un componente: `npx shadcn@latest add <componente>` desde la raíz.
- **Cuidado:** la CLI **sobrescribe** el archivo si ya existe. Los componentes de `ui/` están adaptados a estas reglas (alturas, rellenos, bordes); al agregar uno nuevo, revisarlo contra esta sección antes de usarlo.

### Verificación rápida
Estas búsquedas en `client/src` deben devolver 0 resultados:
```bash
grep -rnE '\b-?[a-z-]+-[0-9]+\.5\b' client/src --include=*.tsx          # clases .5
grep -rnE 'text-\[[0-9]+px\]' client/src --include=*.tsx                 # texto fuera de escala
grep -rnE '(bg|text|border)-(red|green|blue|yellow|gray)-[0-9]{2,3}' client/src/pages client/src/components --include=*.tsx | grep -v /ui/   # colores fijos
grep -rnE '(^|[ "`])bg-(primary|success|destructive|warning|muted|secondary)(/[0-9]+)?([ "`]|$)' client/src/pages client/src/components/*.tsx client/src/App.tsx   # rellenos (solo la barra de progreso del dashboard)
```
