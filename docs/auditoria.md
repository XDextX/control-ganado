# Auditoría de fallos y vulnerabilidades

- **Fecha:** 28 de octubre de 2026
- **Versión revisada:** `v1.0.0` (commit `250c0d3`)
- **Alcance:** todo `src/`, `public/sw.js`, `index.html`, `vite.config.ts` y las dependencias (`npm audit`).

La app no tiene servidor ni cuentas: los datos viven en el teléfono (`localStorage`) y solo entran por tres vías: lo que la persona escribe, una **copia de seguridad** (archivo) y un **código QR**. Por eso la superficie de ataque es pequeña, y lo más importante es que un dato dañado o malicioso que llegue por copia o QR no pueda romper la app ni borrar información.

## Resumen

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta | Una copia o QR con eventos dañados dejaba la app sin poder abrir | Corregido |
| 2 | Alta | Si los datos guardados se dañaban, el siguiente guardado los borraba | Corregido |
| 3 | Media | Un arete reservado (`__proto__`) en una copia daba un error confuso y no se validaban los tipos | Corregido |
| 4 | Media | Venta, borrar un evento y un QR desconocido usaban ventanitas del navegador que algunas apps bloquean | Corregido |
| 5 | Media | La foto de un reporte muy grande fallaba sin avisar | Corregido |
| 6 | Baja | La cámara del escáner seguía encendida al cambiar de app | Corregido |
| 7 | Baja | Sin política de seguridad de contenido (CSP) | Corregido |
| 8 | Baja | El registro del service worker podía dejar un error sin atrapar | Corregido |
| 9 | Crítica (solo desarrollo) | `vitest` 3 depende de versiones vulnerables de `tinypool` y `@vitest/mocker` | **Pendiente: requiere cambio mayor** |

## Detalle

### 1. Copia o QR con eventos dañados deja la app sin abrir (alta)

**Qué pasaba.** `fusionar()` solo revisaba que cada animal tuviera `arete` y una lista de `eventos`, no cómo eran esos eventos. Un evento sin `fecha` (por un archivo editado a mano, cortado al enviarlo o hecho a propósito) entraba igual y se guardaba. Al pintar la lista, `ordenados()` llama a `fecha.localeCompare(...)` y la app se caía con `TypeError`. Como el dato quedaba guardado, **la app se caía cada vez que se abría**.

**Comprobado** con una prueba que reprodujo el error antes de corregirlo.

**Corrección.** `limpiarAnimal()` y `limpiarEvento()` en `src/datos.ts` validan todo lo que entra:
- **Evento:** debe tener `id` de texto, un `tipo` conocido y una fecha `AAAA-MM-DD`.
- **Animal:** sus campos se convierten a texto con largo máximo, y el tipo solo puede ser `leche` o `carne`.
- **Kilos:** deben ser números entre 0 y el máximo.

Los eventos inválidos se descartan y la persona ve cuántos se ignoraron. Se aplica al importar una copia o un QR y también al **cargar** lo guardado, así que repara datos que ya estuvieran dañados.

### 2. Datos guardados ilegibles se borraban en el siguiente guardado (alta)

**Qué pasaba.** Si el JSON guardado en `localStorage` no se podía leer, `cargar()` avisaba y empezaba con la app vacía. El primer cambio que hiciera la persona sobrescribía el dato ilegible, **la única copia que quedaba**.

**Corrección.** Antes de seguir, `cargar()` guarda el contenido ilegible aparte (`ganado.v1.danado-<fecha>`) para poder rescatarlo.

### 3. Aretes reservados y tipos no validados (media)

**Qué pasaba.** Un arete `__proto__` en una copia hacía que `dst.animales[arete]` leyera el prototipo de JavaScript. La importación fallaba con un error confuso. La prueba confirmó que no llegaba a contaminar el objeto. Además, nombres, notas o fincas podían venir como objetos o textos enormes.

**Corrección.** `areteValido()` rechaza vacíos, aretes de más de 40 caracteres y nombres reservados (`__proto__`, `constructor`, `prototype`). La búsqueda usa `Object.hasOwn`. Si un animal de la copia es inválido, **no se importa nada**: nunca queda una copia a medias. El formulario de alta y el escáner usan la misma validación.

### 4. Ventanitas de confirmación bloqueadas por navegadores internos (media)

**Qué pasaba.** Algunas acciones usaban `confirm()`:
- registrar una venta, muerte o baja;
- borrar un evento;
- dar de alta un arete escaneado.

El navegador interno de algunas apps de mensajería bloquea estas ventanitas y `confirm()` devuelve `false` sin mostrar nada, así que la acción **no se podía hacer y la persona no sabía por qué**. Ya había pasado con "Borrar todo" (corregido antes).

**Corrección.**
- **Venta, muerte o baja:** el botón de guardar cambia a "💾 Guardar: Venta (ya no saldrá en la lista)", en rojo, así que la confirmación está a la vista.
- **Borrar un evento:** pide un segundo toque en el mismo botón ("¿Seguro? Toque otra vez").
- **Arete escaneado desconocido:** abre el alta con el número ya puesto. Si no lo quiere, toca Volver.

### 5. Foto de reporte demasiado grande (media)

**Qué pasaba.** Con unos 330 animales o más, la imagen del reporte superaba el máximo que dibujan los teléfonos (en iPhone, unos 16 millones de puntos). `toBlob()` devolvía `null` y el botón "Enviar como foto" no hacía nada.

**Corrección.** La imagen se corta a 12 000 px de alto con la nota "… y N filas más: use Guardar PDF". Si aun así no se puede crear, se avisa. Probado con 500 animales.

### 6. Cámara encendida en segundo plano (baja, privacidad)

**Qué pasaba.** Si la persona cambiaba de app con el escáner abierto, la cámara seguía encendida.

**Corrección.** Al ocultarse la app, la cámara se apaga y queda un botón para encenderla otra vez.

### 7. Sin política de seguridad de contenido (baja, defensa en profundidad)

**Corrección.** La versión publicada incluye una CSP:
- Solo se ejecuta código propio y no se conecta a otros sitios.
- `data:` y `blob:` quedan permitidos para los QR, las fotos de reporte y la cámara.

Va solo en el build, porque en desarrollo Vite necesita conexiones que la regla bloquearía. Se comprobó que la app funciona sin violaciones en la consola.

GitHub Pages no permite cabeceras HTTP propias. Por eso la CSP va como `<meta>`, y `frame-ancestors` no se puede aplicar.

### 8. Error sin atrapar al registrar el service worker (baja)

En navegadores sin service worker (modo privado, navegadores limitados) quedaba un `Uncaught (in promise)`. Ahora se atrapa: la app funciona igual, solo que necesita señal.

### 9. Dependencias de desarrollo vulnerables (pendiente)

`npm audit` reporta 3 vulnerabilidades (2 críticas, 1 moderada), todas en `vitest` 3.2 y sus dependencias:
- `tinypool` ≤ 2.1.1: contaminación de prototipo que permite ejecutar código.
- `@vitest/mocker` ≤ 4.1.11: lectura de archivos e inyección de código.

**No afectan a la app publicada:** `npm audit --omit=dev` da **0 vulnerabilidades**. Solo se usan al correr las pruebas en la computadora de quien desarrolla.

La corrección exige pasar `vitest` de la versión 3 a la 5, que es un **cambio mayor**. Queda como propuesta para aprobar.

## Revisado sin hallazgos

- **Inyección de HTML (XSS):** todo el texto se agrega con `document.createTextNode` (ver `src/jsx.ts`) y no se usa `innerHTML`. Los enlaces de correo y de reporte en el repositorio codifican el texto con `encodeURIComponent`.
- **Comentarios:** solo envían lo que la persona escribe, nunca datos del ganado.
- **Respaldos:** la carpeta del proyecto ignora `respaldo-*.json` y `ganado-copia-*.txt` (`.gitignore`), así que los aretes oficiales no llegan al repositorio público.
- **Service worker:** solo intercepta pedidos del mismo sitio y guarda la página nueva después de sus archivos, para no dejar versiones a medias.
- **Espacio:** un año de pesajes de 50 vacas ocupa menos de 1 MB, lejos del límite de `localStorage` (~5 MB).

## Límites conocidos (no son fallos)

- Un evento borrado vuelve a aparecer si se importa una copia vieja que todavía lo tenía, porque no se guarda registro de lo borrado.
- Los avisos informativos (`alert`) también pueden quedar ocultos en navegadores internos. No bloquean ninguna acción.
