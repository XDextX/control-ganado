import { h } from '../jsx';
import { KEY, cuantos, diasHasta, fusionar, hoy, marcarRespaldo, rescatados, ultimoRespaldo } from '../datos';
import { avisar, avisarError, compartir, quitarError, descargar, est, guardarOVolver, ir, puedeCompartir, render, verEjemplo, volver } from '../estado';
import { leerXlsx, propuestaDeFinca, rangosDeSenasa } from '../senasa';

// Como texto (.txt): algunos navegadores de teléfono no dejan compartir archivos .json, pero sí .txt. El contenido es el mismo.
const archivoCopia = () => new File([JSON.stringify(est.db, null, 1)], `ganado-copia-${hoy()}.txt`, { type: 'text/plain' });
export const textoCopia = (cuando = '') => puedeCompartir(archivoCopia()) ? `📲 Enviar una copia ${cuando} (por mensaje)` : `💾 Guardar una copia ${cuando}`;

export async function guardarCopia() {
  const r = await compartir(archivoCopia(), 'Copia de Registro de Ganado');
  if (r === 'cancelado') return;
  marcarRespaldo(); render();
  avisar(r === 'compartido' ? '✅ Copia enviada' : '💾 Revise que la copia esté en Descargas');
}

// Más que esto no es una copia de esta app (una de cientos de animales y años de pesajes pesa pocos MB).
const MAX_COPIA = 20 * 2 ** 20;

export function CopiaSeguridad() {
  const juntar = (texto: string, que: string) => {
    const esArchivo = que === 'Ese archivo';
    // Una copia de verdad pesa unos KB; un archivo enorme colgaría la pantalla al leerlo.
    if (texto.length > MAX_COPIA) return avisarError(`${que} es demasiado grande para ser una copia de esta app.`);
    if (est.ejemplo) verEjemplo(false); // una copia real nunca se junta con el ejemplo, que no se guarda
    let n;
    // Si el teléfono no puede guardar, se vuelve a como estaba: lo juntado no queda solo en memoria.
    const antes = JSON.stringify(est.db);
    try { n = fusionar(est.db, JSON.parse(texto.trim())) }
    catch (err) {
      // Un texto que no es JSON trae un mensaje técnico del navegador: se dice en palabras simples.
      return avisarError(err instanceof SyntaxError
        ? (esArchivo ? 'Ese archivo está incompleto o no es una copia de esta app. Pida que le manden la copia otra vez.' : 'Ese texto está cortado. Copie el mensaje completo y péguelo otra vez.')
        : `${que} no es una copia de esta app (${(err as Error).message}).`);
    }
    // Recuperar no cuenta como respaldo: lo juntado no está en ninguna otra parte.
    if (!guardarOVolver(antes, 'la copia')) return;
    volver();
    avisar(`✅ Copia recuperada: ${cuantos(n.animales, 'animal nuevo', 'animales nuevos')} y ${cuantos(n.eventos, 'evento nuevo', 'eventos nuevos')}. No se borró nada.${n.descartados ? (n.descartados === 1 ? ' Se ignoró 1 dato dañado.' : ` Se ignoraron ${n.descartados} datos dañados.`) : ''}`, 7000);
  };
  const recuperar = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = '';
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return file.size > MAX_COPIA ? avisarError('Ese archivo es demasiado grande para ser una copia de esta app.') : juntar(await file.text(), 'Ese archivo');
    // El Excel de SENASA no se junta de una vez: primero se elige a qué finca va cada entrega y de qué tipo son.
    try {
      if (est.ejemplo) verEjemplo(false);
      const rangos = rangosDeSenasa(await leerXlsx(await file.arrayBuffer()));
      quitarError('otros'); // el Excel bueno quita el aviso de un intento anterior (no el de guardado)
      est.senasa = { rangos, destinos: Object.fromEntries([...new Set(rangos.map(r => r.finca))].map(f => [f, propuestaDeFinca(est.db, f)])) };
      ir('senasa');
    } catch (err) { avisarError('No se pudo leer ese Excel: ' + (err as Error).message + '. Descargue otra vez el Excel de SENASA y pruebe de nuevo.') }
  };
  // Sin archivos: algunos teléfonos o navegadores internos no dejan descargar ni compartir archivos, pero sí texto.
  const enviarTexto = async () => {
    const texto = JSON.stringify(est.db);
    try { await navigator.share({ text: texto }); marcarRespaldo(); render(); return avisar('✅ Copia enviada') }
    catch (e) { if ((e as Error).name === 'AbortError') return }
    try { await navigator.clipboard.writeText(texto); avisar('✅ Copia copiada: péguela en un mensaje') }
    catch { manual.value = texto; manual.classList.remove('hide'); manual.select(); avisar('Mantenga el dedo sobre el texto marcado y elija Copiar. Después péguelo en un mensaje.', 8000) }
  };
  let archivo!: HTMLInputElement, manual!: HTMLTextAreaElement, pegado!: HTMLTextAreaElement, falta!: HTMLElement;
  return (
    <details open={!Object.keys(est.db.animales).length}>
      <summary>⚙️ Copia de seguridad</summary>
      <p class="ayuda">Guarde una copia seguido para no perder sus datos si se daña o cambia de teléfono. También sirve para pasar todos los animales a otro teléfono por mensaje.</p>
      <button class="grande" onClick={guardarCopia}>{textoCopia()}</button>
      {/* En el teléfono el botón de arriba abre el menú de compartir; este guarda el archivo en Descargas */}
      {puedeCompartir(archivoCopia()) && <button class="grande" onClick={() => { descargar(archivoCopia(), archivoCopia().name); marcarRespaldo(); render(); avisar('💾 Revise que la copia esté en Descargas') }}>💾 Guardar la copia en este teléfono</button>}
      <button class="grande" onClick={() => archivo.click()}>📂 Recuperar una copia</button>
      <input ref={(el: HTMLInputElement) => (archivo = el)} type="file" accept=".json,.txt,.xlsx,application/json,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hide" onChange={recuperar} />
      {rescatados().map(k => <button class="grande" onClick={() => compartir(new File([localStorage.getItem(k) ?? ''], `ganado-rescatado-${k.slice((KEY + '.danado-').length)}.txt`, { type: 'text/plain' }), 'Datos rescatados')}>🛟 Guardar los datos rescatados</button>)}
      <h3>¿No se puede guardar el archivo?</h3>
      <p class="ayuda">Envíe la copia como texto en un mensaje (a usted mismo o a otro teléfono). Para recuperarla, copie ese mensaje y péguelo abajo.</p>
      <button class="grande" onClick={enviarTexto}>✉️ Enviar la copia como texto</button>
      <textarea class="hide" rows="4" readonly ref={(el: HTMLTextAreaElement) => (manual = el)}></textarea>
      <label for="c-pegar">Pegue aquí una copia recibida como texto</label>
      <textarea id="c-pegar" rows="3" aria-describedby="c-pegar-error" ref={(el: HTMLTextAreaElement) => (pegado = el)} onInput={() => { falta.textContent = '' }}></textarea>
      {/* Este error va debajo de su cuadro, no flotando: así no tapa el cuadro donde hay que pegar */}
      <p id="c-pegar-error" class="error-campo" role="alert" ref={(el: HTMLElement) => (falta = el)}></p>
      <button class="grande" onClick={() => {
        if (pegado.value.trim()) { falta.textContent = ''; return juntar(pegado.value, 'Ese texto') }
        falta.textContent = 'Primero pegue el texto de la copia en este cuadro.'; pegado.focus();
      }}>📥 Recuperar la copia pegada</button>
    </details>
  );
}

export function AvisoRespaldo() {
  if (!Object.keys(est.db.animales).length) return null;
  const ult = ultimoRespaldo(), d = ult ? -diasHasta(ult) : null;
  if (d !== null && d < 7) return null;
  return (
    <div class="card warn">
      💾 {d === null ? 'Todavía no ha guardado una copia de sus datos.' : `Su última copia es de hace ${d} días.`}
      <button class="grande" onClick={guardarCopia}>{textoCopia('ahora')}</button>
    </div>
  );
}
