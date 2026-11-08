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
  senasa.ts           Leer el Excel de SENASA (.xlsx sin librerías) y agregar sus aretes
  estilos.css         Todos los estilos (claro/oscuro, letra grande, impresión)
  componentes/        Piezas reutilizables: Arete, CopiaSeguridad, EliminarDatos, Comentarios, Encabezado, Ordenos
  vistas/             Una pantalla por archivo: Lista, Ficha, Pesaje, Mover, Reportes, Codigos, Senasa
  storybook.tsx       Historias del catálogo /storybook
  *.test.ts           Pruebas de datos.ts, reportes.ts, qr.tsx y senasa.ts
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
- `avisar('✅ …', ms)` muestra la franja verde: dura 2,2 s, o `ms` para un mensaje largo; una nueva reemplaza a la anterior y se puede cerrar con «✕ Cerrar».
- `avisarError(texto)` muestra una franja roja que se cierra con «✕ Cerrar» (también con el teclado). **Ningún aviso flota**: todos van en `#avisos`, al principio de la página, y empujan el contenido en vez de tapar botones o campos. El de "no se pudo guardar" (`guardado: true`) va siempre primero, no se lleva el foco (no hace saltar la página) y solo se quita al tocarlo o cuando un guardado sale bien; puede convivir con otro rojo. `quitarError('otros' | 'guardado' | 'todos')` elige cuál quitar, y si el aviso tenía el foco, lo pasa a la pantalla. Un error de un campo va debajo del campo con `aria-describedby`: `errorCampo(campo, texto)` lo pone (el campo necesita `id`), lleva el foco al campo y lo borra al escribir. **No use `alert()`, `confirm()` ni `prompt()`** (ver «Acciones destructivas»): el navegador interno de algunas apps de mensajes las bloquea. Los problemas al leer lo guardado (`cargar`) quedan en `problemaAlCargar` y se muestran en rojo apenas existe la página, con `queda: true`: ese aviso va justo debajo de `#avisos` (no queda pegado arriba con los verdes) y no se quita al cambiar de pantalla. Lo que se junta de una vez (una copia, un QR) se guarda con `guardarOVolver`: si no se puede guardar, todo vuelve a como estaba y lo dice.

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
- **Concentrado:** `concentrado(kg)` = kg de leche del día ÷ `LECHE_POR_KG_CONCENTRADO` (3), redondeado a 0,1; el total del día es la suma por vaca. Un pesaje con un solo ordeño se avisa ("solo con un ordeño") porque el concentrado sale solo sobre ese ordeño. El ordeño sin pesar se muestra «—» con `componentes/Ordenos.tsx`.
- **Kilos en pantalla:** `kilos()` usa un espacio que no se parte (`\u00a0`) entre el número y "kg", y la clase `.nw` une ícono y valor: nunca salen cortados. En la foto de un reporte, la letra de las tablas se achica (30 → 27 → 24 px) para no partir palabras, y es una sola para toda la imagen: la que necesita la tabla más ancha; en pantalla, solo la tabla se desliza de lado (`.desliza`), con una pista en el celular.
- **Fechas:** siempre texto `AAAA-MM-DD` en hora **local** (`hoy()`, `fechaLocal`). Para sumar días se usa UTC a mediodía (`sumarDias`), así el horario no mueve la fecha.

## Excel de SENASA (`senasa.ts`)

"Recuperar una copia" también acepta el `.xlsx` de SENASA con los rangos de aretes por finca. Se lee en el teléfono sin librerías: `leerXlsx` abre el `.zip` con `DecompressionStream` y saca las celdas del XML; `rangosDeSenasa` busca las columnas por su encabezado ("Rango Inicial", "Rango Final"…). La pantalla `vistas/Senasa.tsx` deja elegir finca y tipo (leche/carne) por cada finca del Excel; `agregarSenasa` crea solo los aretes que faltan de los rangos seguidos (hasta `MAX_POR_ENTREGA`), llena la finca vacía de los que ya existen y avisa los rangos con huecos. No se guardan nombres de fincas en el código: el repositorio es público. El largo normal de un arete sale de los aretes de 10 dígitos o más que ya están en la app (los números propios cortos no cuentan) o, si no hay, del Excel; un arete más corto o más largo se avisa y no se agrega.

## Sincronización entre teléfonos

No hay servidor: los datos se pasan por **copia de seguridad** (archivo `.txt` con el JSON) o por **QR** (texto `GANADO1:` + JSON).

`fusionar(destino, recibido)` **nunca borra**:
1. Valida todo con `limpiarAnimal`/`limpiarEvento`. Si un animal no tiene forma válida, rechaza el archivo entero; los eventos inválidos se descartan y se cuentan.
2. Animales nuevos se agregan; en los existentes se suman los eventos cuyo `id` no estaba. Los datos del animal (nombre, notas…) que aquí están **vacíos** se completan con la copia; los ya escritos **no se pisan**.
3. Si llegó un traslado, la finca del animal pasa a la del traslado más reciente.

`cambiosDesde(db, fecha)` arma "lo anotado desde un día" para el QR: eventos cuyo `id` dice que se anotaron ese día o después, más los animales con `creado` en ese periodo, sin campos vacíos para que quepa.

`juntar(db, provisional, registrado)` aplica la misma suma a un animal con arete provisional que resultó ser uno ya registrado, y borra el provisional. Solo en este teléfono: los otros siguen teniendo el provisional hasta que se corrija allí.

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
- Acciones destructivas o importantes **no** usan `alert()`, `confirm()` ni `prompt()` (el navegador interno de algunas apps de mensajes los bloquea): se confirma dentro de la pantalla (escribir BORRAR, segundo toque, botón que dice lo que hará).
- CSP en el build (`vite.config.ts`): solo código propio; `data:`/`blob:` para QR, fotos y cámara. Si agrega un recurso externo, hay que ajustarla.
- Los respaldos con aretes oficiales están en `.gitignore`: el repositorio es público.

Detalle y estado de cada hallazgo: [auditoria.md](auditoria.md).

## Accesibilidad (usuarios mayores)

Es un requisito, no un adorno:
- Botones grandes (mínimo 56 px de alto), letra base 19 px (23 px con "letra más grande"), contraste alto en claro y oscuro.
- Texto simple, sin códigos ni palabras técnicas; los números de arete con los últimos 4 dígitos en grande.
- Confirmar con mensajes claros (`avisar`) y nunca depender solo del color.
- Lo que se toca también se usa con teclado: las tarjetas de la lista tienen `role="button"` y `tabindex="0"` y se abren con Enter o espacio; los avisos de la lista son un `<button>` dentro de cada `<li>`, para que el lector siga anunciando la lista. Tras agregar el Excel de SENASA, el foco va al título del resumen.
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
