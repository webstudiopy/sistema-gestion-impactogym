# GymControl Pro

Sistema web para gimnasio hecho con **Bootstrap + Supabase**, listo para publicar en **GitHub Pages**.

## Incluye

- registro de socios
- planes predefinidos:
  - Diario = Gs. 10.000
  - Semanal = Gs. 40.000
  - Mensual = Gs. 130.000
- registro de pagos
- tabla separada de `formas_pago`
- reporte por método de pago
- vencimientos en rojo cuando ya pasó la fecha
- montos formateados como `130.000`
- diseño más limpio y profesional
- sin pantalla de configuración dentro del sistema

## Cómo conectar

1. Ejecuta el archivo `sql/schema.sql` en Supabase.
2. Abre `js/app.js`.
3. Reemplaza estas dos líneas:

```js
const SUPABASE_URL = 'PEGAR_AQUI_TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PEGAR_AQUI_TU_SUPABASE_ANON_KEY';
```

4. Guarda los cambios.
5. Sube la carpeta a GitHub Pages.

## Publicar en GitHub Pages

Sube todo el contenido al repositorio y activa GitHub Pages desde la rama principal.

## Nota

Este proyecto usa la anon key pública de Supabase. Para algo más serio a futuro, conviene agregar login y mejorar reglas RLS.
