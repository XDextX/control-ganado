# Manual para desarrolladores

Guía para entender, cambiar y publicar **Registro de Ganado**. Para usar la app, ver [manual-usuario.html](../public/manual-usuario.html).

## En una frase

App web de una sola página, hecha con **Vite + TypeScript + TSX propio** (sin React ni otra librería de interfaz). Funciona sin conexión gracias a un service worker y guarda todo en el `localStorage` del teléfono: **no hay servidor ni cuentas**. Se publica sola en GitHub Pages con cada push a `main`.

## Empezar

Requiere Node 22.12 o superior.

```bash
npm install
npm run dev        # http://localhost:5173  ·  catálogo de componentes en /storybook
npm test           # pruebas (vitest)
npm run build      # tsc + vite build → dist/
npm run preview    # sirve dist/ (para probar el service worker y la CSP)
```

El service worker solo se registra en producción (`import.meta.env.PROD`). Para probar el modo sin señal, use `npm run build && npm run preview` en Chrome; el navegador integrado de algunos editores no permite service workers.

## Mapa del código

```
index.html            Metadatos (SEO, tarjeta para redes, íconos) y texto para buscadores; monta #app
vite.config.ts        base './', TSX con h/Fragment, CSP (solo en build), ruta /storybook (solo en dev)
storybook.html        Página del catálogo de componentes (no entra al build)
public/
  manual-usuario.html Manual de uso (se publica; fuente del PDF); capturas/ son sus imágenes
  sw.js               Service worker: copia local primero, actualización por detrás
  manifest.json       Instalación en pantalla de inicio (íconos PNG normales y "maskable")
  icon*.png/.svg      Íconos (dibujo propio, sin emojis de terceros)
  og.png              Imagen de la tarjeta al compartir el enlace (1200×630)
  robots.txt, sitemap.xml
src/
  jsx.ts              El "React" de la app: h() crea nodos DOM reales; el texto siempre es texto
  main.tsx            Arranque: tabla de vistas, render inicial, registro del service worker
  estado.tsx          Estado compartido (est), navegación (ir/abrir/volver), avisar, compartir, descargar
  datos.ts            Modelo, reglas del hato, validación y fusión. Sin DOM: se prueba con vitest
  reportes.ts         Reportes como datos + reporteAImagen() (canvas)
  qr.tsx              Generar y leer códigos QR (qrcode, jsqr), formato del QR
  config.ts           Correo de comentarios y URL del repositorio
  estilos.css         Todos los estilos (claro/oscuro, letra grande, impresión)
  componentes/        Piezas reutilizables: Arete, CopiaSeguridad, EliminarDatos, Comentarios, Encabezado
  vistas/             Una pantalla por archivo: Lista, Ficha, Pesaje, Mover, Reportes, Codigos
  storybook.tsx       Historias del catálogo /storybook
  *.test.ts           Pruebas de datos.ts, reportes.ts y qr.tsx
docs/
  auditoria.md        Fallos y vulnerabilidades encontrados y su estado
  desarrollo.md       Este documento
```

## Cómo se pinta la pantalla

No hay virtual DOM. Cada vista es una función que **devuelve nodos DOM nuevos** a partir de `est`:

```tsx
import { h } from '../jsx';
export function MiVista() {
  return <section><h2>Hola</h2><button onClick={() => { est.algo = 1; render() }}>Tocar</button></section>;
}
```

- `render()` vuelve a construir toda la pantalla (`main.tsx` registra cómo con `alPintar`). Es barato porque las pantallas son pequeñas.
- `ir(vista)` cambia de pantalla, apaga la cámara si estaba encendida y sube al inicio. `abrir(arete)` abre la ficha (`null` = alta).
- Para no perder el foco al escribir (por ejemplo, el buscador), la vista repinta **solo un trozo**: guarda un contenedor con `ref` y llama `cont.replaceChildren(<Parte />)`.
- `ref={(el) => …}` recibe el elemento real. `value` y `checked` se asignan como propiedad; lo demás, como atributo.
- Estado que no debe perderse entre repintados va en `est` (`estado.tsx`) o en una variable del módulo de la vista (como `origen` en `Mover.tsx`).
- `avisar('✅ …')` muestra el mensaje grande verde.

**Seguridad de la interfaz:** `h()` agrega el texto con `createTextNode`, así que un nombre o nota con `<script>` se ve como texto. No use `innerHTML`.

## Modelo de datos

Todo vive en `localStorage['ganado.v1']` como `{ animales: { [arete]: Animal } }`.

```ts
interface Animal {
  arete: string; nombre: string; tipo: 'leche' | 'carne'; nac: string /* AAAA-MM-DD o '' */;
  finca: string; sexo: 'H' | 'M'; raza: string; categoria: string; notas: string;
  eventos: Evento[];
  creado?: string;          // día en que se dio de alta en este teléfono
}
interface Evento {
  id: string;               // nuevoId(): hora en base 36 + 4 al azar → también dice cuándo se anotó
  tipo: 'celo' | 'monta' | 'prenez' | 'parto' | 'aborto' | 'destete' | 'secado' | 'retiro' | 'traslado' | 'pesaje';
  fecha: string;            // AAAA-MM-DD, cuándo pasó
  nota: string;
  motivo?: string;          // retiro: 'Venta' | 'Muerte' | 'Baja (desecho)'
  desde?: string; hacia?: string;  // traslado
  am?: number; pm?: number;        // pesaje, en kg
}
```

Otras claves: `ganado.v1.respaldo` (fecha de la última copia enviada o guardada; recuperar no cuenta), `ganado.v1.letra` (letra grande) y `ganado.v1.danado-<ms>` (datos ilegibles rescatados, ver auditoría).

**Regla de oro: no romper el formato.** Los teléfonos guardan datos y copias viejas que deben seguir abriendo. Agregue campos **opcionales** y tipos de evento nuevos; no renombre ni quite campos. Si un cambio exige migrar datos, es un cambio mayor: proponerlo antes (y subir la versión mayor).

### Reglas del hato (`datos.ts`)

- **Parto probable:** última monta + `GESTACION` (283 días). Si no hay monta, se usa la preñez confirmada. Un parto, aborto o celo posterior cierra la preñez (`prenezAbierta`); ese celo se muestra como repetición (`esRepeticion`). Los machos nunca tienen preñez.
- **Secado:** parto probable − `SECADO_ANTES` (60 días), solo en vacas de leche. **Seca:** último secado posterior al último parto (`estaSeca`).
- **Avisos:** partos y secados a 30 días o menos (`alertas`).
- **Pesaje:** un evento por vaca y día (`guardarPesajes` reemplaza). `leerKilos` acepta coma, rechaza más de `MAX_KILOS` (60) por ordeño. `esRaro`: más del doble o menos de la mitad que la vez anterior.
- **Fechas:** siempre texto `AAAA-MM-DD` en hora **local** (`hoy()`, `fechaLocal`). Para sumar días se usa UTC a mediodía (`sumarDias`), así el horario no mueve la fecha.

## Sincronización entre teléfonos

No hay servidor: los datos se pasan por **copia de seguridad** (archivo `.txt` con el JSON) o por **QR** (texto `GANADO1:` + JSON).

`fusionar(destino, recibido)` **nunca borra**:
1. Valida todo con `limpiarAnimal`/`limpiarEvento`. Si un animal no tiene forma válida, rechaza el archivo entero; los eventos inválidos se descartan y se cuentan.
2. Animales nuevos se agregan; en los existentes se suman los eventos cuyo `id` no estaba. Los datos del animal (nombre, notas…) que aquí están **vacíos** se completan con la copia; los ya escritos **no se pisan**.
3. Si llegó un traslado, la finca del animal pasa a la del traslado más reciente.

`cambiosDesde(db, fecha)` arma "lo anotado desde un día" para el QR: eventos cuyo `id` dice que se anotaron ese día o después, más los animales con `creado` en ese periodo, sin campos vacíos para que quepa.

Límites conocidos: un evento borrado vuelve si se importa una copia vieja (no hay registro de borrados), y los cambios de datos de un animal existente solo viajan en la copia completa… y aun así solo llenan lo que en el otro teléfono estaba vacío: un nombre **cambiado** (no vacío) no viaja.

## Funcionar sin conexión (`public/sw.js`)

Estrategia **copia local primero, actualización por detrás**:
- Abrir la app responde al instante con la página guardada y, en paralelo, `actualizar()` baja la nueva. La versión nueva se ve en la **siguiente** apertura.
- `actualizar()` lee los archivos con hash (`assets/index-XXXX.js|css`) desde la página, los guarda **antes** que la página (nunca una página que apunte a archivos ausentes) y borra los de versiones viejas.
- Si cambia la estrategia o hay que forzar limpiar todo, suba `CACHE` (`ganado-v4` → `v5`).

## Seguridad

- Todo lo que entra por copia o QR pasa por `limpiarAnimal`/`limpiarEvento` (tipos, largos, fechas, tipos de evento conocidos, kilos posibles, aretes reservados como `__proto__`). Lo guardado también se limpia al cargar.
- Si lo guardado es ilegible o algo no pasa la validación, el original se rescata en `ganado.v1.danado-*`, se avisa y se ofrece guardarlo desde Copia de seguridad.
- Para guardar desde la interfaz use `guardarYAvisar`: si falla, lo dice en pantalla y no muestra el mensaje de éxito.
- Acciones destructivas o importantes **no** usan `confirm()`/`prompt()` (el navegador interno de algunas apps los bloquea): se confirma dentro de la pantalla (escribir BORRAR, segundo toque, botón que dice lo que hará).
- CSP en el build (`vite.config.ts`): solo código propio; `data:`/`blob:` para QR, fotos y cámara. Si agrega un recurso externo, hay que ajustarla.
- Los respaldos con aretes oficiales están en `.gitignore`: el repositorio es público.

Detalle y estado de cada hallazgo: [auditoria.md](auditoria.md).

## Accesibilidad (usuarios mayores)

Es un requisito, no un adorno:
- Botones grandes (mínimo 56 px de alto), letra base 19 px (23 px con "letra más grande"), contraste alto en claro y oscuro.
- Texto simple, sin códigos ni palabras técnicas; los números de arete con los últimos 4 dígitos en grande.
- Confirmar con mensajes claros (`avisar`) y nunca depender solo del color.
- Cada cambio de interfaz conviene revisarlo con el "ejercicio de usuario": recorrer la app como una persona de 60+ con poca vista.

## Agregar algo

**Un tipo de evento:** agréguelo a `EVENTOS` en `datos.ts` (la validación lo acepta solo por estar ahí), luego un botón en `COMUNES` u `OTROS` (`vistas/Ficha.tsx`) y, si se muestra distinto, en `textoEvento`. Si necesita campos, agréguelos opcionales a `Evento` **y** a `limpiarEvento`.

**Una pantalla:** cree `src/vistas/MiVista.tsx`, agregue el nombre al tipo `Vista` (`estado.tsx`) y a `VISTAS` (`main.tsx`), y un botón con `ir('miVista')`. Agregue su historia en `src/storybook.tsx`.

**Un reporte:** función en `reportes.ts` que devuelva `{ titulo, sub, secciones }`, nombre en `TipoReporte`, botón en `MenuReportes` y caso en `armar` (`vistas/Reportes.tsx`). La foto y el PDF salen solos.

## Pruebas y verificación

- `npm test`: reglas del hato, validación, fusión, QR y reportes. Toda lógica nueva lleva su prueba.
- `/storybook` (con `npm run dev`): cada pieza y pantalla con datos de ejemplo, en un marco de celular. No guarda nada.
- Antes de publicar: `npm run build`, probar en el navegador a ancho de celular (claro y oscuro) y, si toca el service worker, `npm run preview` con la red en "sin conexión".

## Publicar

- Cada push a `main` corre `.github/workflows/pages.yml`: instala, prueba, compila y publica `dist/` en GitHub Pages (≈ 30 s).
- Versiones con etiquetas de git: `git tag -a vX.Y.Z -m "…" && git push origin vX.Y.Z`. Mayor (X) si rompe el formato de datos o cómo se usa; menor (Y) si agrega funciones; parche (Z) si corrige.
- Los mensajes de commit van en español y sin líneas de atribución.
