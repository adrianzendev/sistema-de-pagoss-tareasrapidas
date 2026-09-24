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

## Sistema de diseño: Flat Outlined + rejilla 4/8 puntos (OBLIGATORIO)

Toda vista o componente nuevo o modificado debe cumplir estas reglas. Los tokens viven en `client/src/index.css` y `tailwind.config.ts`; los componentes base en `client/src/components/ui/`.

### Flat Outlined
- **Sin sombras.** Las clases `shadow-*` están mapeadas a variables `--shadow-*` que valen `0 0 #0000`. No usar sombras arbitrarias (`shadow-[...]`).
- **Bordes definidos de 1 px** con tokens: `border border-border` (claro `220 13% 85%`, oscuro `220 13% 24%`). Tarjetas, inputs, selects, modales, menús, badges y botones outline llevan borde.
- **Cajas con fondo de color llevan borde del mismo tono:** `bg-muted` → `border border-border`; `bg-primary/10` → `border border-primary/30` (igual con `success`, `destructive`, `warning`).
- **Fondos limpios:** `background`, `card` y `popover` son blancos en claro; la separación la da el borde, no un gris.
- **Solo tokens de color:** `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `sidebar-*`. Prohibido `text-red-500`, `bg-blue-600`, `border-gray-300`, degradados, etc.
- **Sidebar:** borde derecho `border-sidebar-border`; ítem activo `border-sidebar-border bg-muted/50 text-primary font-medium`; hover con borde (definido en `ui/sidebar.tsx`).
- Excepciones: el oscurecido detrás de los modales (`bg-black/80`), los círculos de ícono (`rounded-full`) y los colores que son datos (p. ej. el color blanco/negro de una moneda).

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
```
