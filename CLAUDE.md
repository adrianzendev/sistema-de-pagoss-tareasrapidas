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

## Semanas contables (OBLIGATORIO)

Las semanas contables operan estrictamente de **LUNES a DOMINGO (hora Perú, `America/Lima`)**. Ejemplo: S199 = lunes 21 – domingo 27 sep 2026.

- **Servidor:** `server/utils/peru-time.ts` → `todayPeru()`, `weekRangeOf(fecha)` (lunes–domingo que contiene la fecha, equivale a `weekStartsOn: 1`), `addDays`, `peruDateOf(instante)`. Las rutas que generan semanas usan `weekRangeOf`; `storage.getCurrentWeek()` usa `todayPeru()`.
- **Cliente:** `todayPeru()` y `peruDate()` de `client/src/lib/utils.ts`. Nunca `new Date().toISOString().split("T")[0]` para "hoy" (es UTC: de 19:00 a 24:00 en Perú ya es el día siguiente).
- **Pagos ↔ semana:** los pagos no guardan `weekId`; pertenecen a la semana cuyo rango contiene la fecha de `created_at` en hora Perú (`DATE(created_at AT TIME ZONE 'America/Lima') BETWEEN start_date AND end_date`). No filtrar con horas del servidor.

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
- **Badges solo para estados.** `<Badge>`/píldoras se usan únicamente para estados de sistema: Activo/Inactivo, Pendiente/Verificado/Rechazado/Reembolsado, Abierta/Cerrada/Pagada, Pagado/Por pagar, "Ya cobrado", y el contador de avisos del sidebar. Todo dato informativo (comisiones %, divisas —separadas por comas: "PEN, USD"—, montos, fechas, teléfonos, contadores, etiquetas descriptivas) va en texto plano (`text-sm`, `text-muted-foreground` si es secundario), sin borde ni recuadro.
- **Hover y foco:** solo gris neutro muy claro (`hover:bg-accent`, `hover:bg-muted/40`, `focus:bg-accent`) o el efecto `hover-elevate`. Nunca hover de color (`hover:bg-success/20`).
- **Sin sombras.** Ningún componente usa clases `shadow-*` (ni `shadow-[...]`). Por si la CLI de shadcn las reintroduce, las variables `--shadow-*` valen `0 0 #0000`.
- **Bordes definidos de 1 px** con tokens: `border border-border` (claro `220 13% 85%`, oscuro `220 13% 24%`). Tarjetas, inputs, selects, modales, menús, badges, botones y cajas llevan borde. Bordes de color al 30–40 % (nunca `/10`–`/20`, no se ven sin fondo).
- **Solo tokens de color:** `primary`, `muted-foreground`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `sidebar-*`. Prohibido `text-red-500`, `bg-blue-600`, `border-gray-300`, `bg-[#…]`, hex/RGB en `style`, degradados, etc.
- **Mapa de tokens** (variables HSL en `index.css`, `:root` = claro, `.dark` = oscuro; Tailwind las expone como `hsl(var(--x) / <alpha-value>)`):

  | Token | Uso |
  |---|---|
  | `background`, `card`, `popover`, `sidebar` | Superficies (blancas en claro) |
  | `foreground` | Texto principal |
  | `muted-foreground` | Texto secundario, íconos inactivos |
  | `border`, `input` | Bordes de contenedores / de inputs y selects |
  | `primary` | Acción principal, activo, enlaces (borde + texto) |
  | `success` / `warning` / `destructive` | Estados verificado / pendiente / rechazado o peligro (borde al 40 % + texto) |
  | `accent`, `sidebar-accent` | Gris neutro de hover |
  | `ring` | Anillo de foco |
  | `chart-1…5` | Solo gráficos |

  Un color nuevo = variable nueva en `:root` **y** `.dark` + entrada en `tailwind.config.ts`; nunca un valor suelto en un componente.
- **Navegación: estado activo solo con tipografía y color.** Los ítems de navegación (menú del sidebar, subítems, pestañas, toggles, paginación) **no llevan fondo ni borde** en su estado activo. El `border` se reserva para contenedores (tarjetas, modales, tablas, cajas, inputs, botones de acción y el divisor `border-r` del sidebar).
  - Activo: `text-primary font-semibold`, sin `bg-*` ni `border-*`.
  - Inactivo: `text-muted-foreground`, sin fondo.
  - Hover: gris neutro suave, sin color → `hover:bg-accent/60` (sidebar `hover:bg-sidebar-accent/60`).
  - Nada de subrayados (`border-b-2`) ni contornos para marcar la pestaña activa.
  - Definido en `ui/sidebar.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx` y `ui/pagination.tsx`; las pestañas hechas a mano (p. ej. `admin/tutor-view.tsx`) usan las mismas clases.
- **Sidebar:** fondo blanco y borde derecho `border-sidebar-border`; los ítems siguen la regla de navegación de arriba.
- **Controles:** checkbox marcado = borde y check `primary` sobre blanco; switch = pista blanca con borde (`primary` al activarse) y punto de color.
- **Excepciones permitidas:** el oscurecido detrás de los modales (`bg-black/80`), las barras de progreso y gráficos (el relleno *es* el dato), los placeholders de carga (`animate-pulse`, `ui/skeleton.tsx`), el punto del switch y los colores que son datos (p. ej. el color blanco/negro de una moneda).

- **Modales:** `ui/dialog.tsx` y `ui/alert-dialog.tsx` usan `w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg`: 16 px de margen en móvil y scroll interno. Las pantallas solo cambian el `max-w`.
- **Layout de páginas:** no hay `PageLayout`; el contenedor común es `<main className="p-4 sm:p-6">` de `App.tsx`. Cada página empieza con `<div className="space-y-6">` (sin `max-w-*`, salvo formularios angostos como `tutor/new-payment.tsx`) y un encabezado `h1 text-2xl font-bold tracking-tight` + subtítulo `text-muted-foreground`.
- **Columna fija (`sticky left-0`):** siempre con `bg-card z-10 border-r border-border` y sin `opacity-*`, para que el contenido no se transparente al deslizar.
- **Sidebar:** el ítem activo es el de URL más larga que coincide con la ruta (`app-sidebar.tsx`), así las subrutas (`/admin/tutors/:id/detail`) marcan su sección.

### Rejilla 4/8 puntos
- **Solo la escala de Tailwind** (1 = 4 px). Prohibido `.5` (`p-1.5`, `gap-2.5`, `h-3.5`…) y valores arbitrarios en px (`p-[5px]`, `h-[18px]`), salvo líneas de 1–2 px y anchos fijos múltiplos de 4.
- **Layout (pasos de 8 px):** `main` con `p-4 sm:p-6` (en `App.tsx`); secciones de cada pantalla con `space-y-6`; grids de tarjetas y de cajas con borde con `gap-4`; pares etiqueta–valor y grupos de botones con `gap-2`.
- **Ajustes internos (pasos de 4 px):** `1` y `3` solo dentro de elementos compactos (ícono–texto, badges, celdas).
- **Tarjetas:** relleno por defecto `p-6`; KPI con `<CardContent className="pt-6">`; tabla dentro de tarjeta con `<CardContent className="p-0">`.
- **Tablas (compactas):** encabezado `h-10 px-4`, celda `px-4 py-3`, definidos en `ui/table.tsx`. **No sobrescribir** el relleno de `TableHead`/`TableCell` en las pantallas; solo las filas auxiliares (separadores de semana, detalle anidado) usan `py-2`.
- **Tablas: íconos y tipografía.** Las celdas no llevan íconos si el encabezado de columna ya identifica el dato (nada de ícono de calendario en Fecha ni de teléfono en Teléfono). Escala fija:
  - Encabezado: `text-xs font-medium uppercase tracking-wider text-muted-foreground` (ya en `ui/table.tsx`; en las pantallas solo alineación y color de columna).
  - Dato: `text-sm font-normal text-foreground` (lo que da `TableCell` sin clases; `font-mono` para teléfonos y códigos).
  - Metadato (hora bajo la fecha, número de fila): `text-xs text-muted-foreground`.
  - Montos y totales: `font-semibold` (+ `tabular-nums`). Es el único peso extra permitido en celdas: nada de `font-medium`/`font-bold` en datos.
- **Controles:** alturas 32 / 40 / 48 px (`size="sm"` / normal / `size="lg"`); inputs y selects 40 px; botón de ícono 40 × 40.
- **Íconos:** 12 / 16 / 20 px (`h-3`, `h-4`, `h-5`). Única excepción: ícono de estado vacío `h-8 w-8 mx-auto mb-4 text-muted-foreground`.
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
grep -rnE '(^|[ "`])bg-(primary|success|destructive|warning|muted|secondary)(/[0-9]+)?([ "`]|$)' client/src/pages client/src/components/*.tsx client/src/App.tsx   # rellenos
grep -rnE '(bg|text|border|fill|stroke|ring)-\[(#|rgb|hsl)|#[0-9a-fA-F]{6}\b' client/src --include=*.tsx   # colores arbitrarios / hex
grep -rnE '(^|[ "`:])shadow(-[a-z0-9]+)?([ "`]|$)' client/src --include=*.tsx | grep -v shadow-none   # sombras
grep -rlE '<(table|td|th)[ >]' client/src/pages client/src/components/*.tsx   # tablas a mano (solo el detalle anidado de tutor-detail)
grep -rnE '<Badge[^>]*>[^<]*(%|\{[^}]*(Percent|amount|code|total|length)[^}]*\})' client/src/pages client/src/components/*.tsx   # badges con datos
```
