import { h } from '../jsx';
import { KEY, cuantos, diasHasta, fusionar, hoy, marcarRespaldo, rescatados, ultimoRespaldo } from '../datos';
import { avisar, compartir, descargar, est, guardarYAvisar, puedeCompartir, render, verEjemplo, volver } from '../estado';

// Como texto (.txt): algunos navegadores de teléfono no dejan compartir archivos .json, pero sí .txt. El contenido es el mismo.
const archivoCopia = () => new File([JSON.stringify(est.db, null, 1)], `ganado-copia-${hoy()}.txt`, { type: 'text/plain' });
export const textoCopia = (cuando = '') => puedeCompartir(archivoCopia()) ? `📲 Enviar una copia ${cuando} (por mensaje)` : `💾 Guardar una copia ${cuando}`;

export async function guardarCopia() {
  const r = await compartir(archivoCopia(), 'Copia de Registro de Ganado');
  if (r === 'cancelado') return;
  marcarRespaldo(); render();
  avisar(r === 'compartido' ? '✅ Copia enviada' : '💾 Revise que la copia esté en Descargas');
}

export function CopiaSeguridad() {
  const juntar = (texto: string, que: string) => {
    if (est.ejemplo) verEjemplo(false); // una copia real nunca se junta con el ejemplo, que no se guarda
    try {
      const n = fusionar(est.db, JSON.parse(texto.trim()));
      // Recuperar no cuenta como respaldo: lo juntado no está en ninguna otra parte.
      const ok = guardarYAvisar(); volver(); if (ok) alert(`Copia recuperada.\n\nSe agregaron ${cuantos(n.animales, 'animal nuevo', 'animales nuevos')} y ${cuantos(n.eventos, 'evento nuevo', 'eventos nuevos')}. No se borró nada.${n.descartados ? (n.descartados === 1 ? '\n\nSe ignoró 1 dato dañado que venía mal escrito.' : `\n\nSe ignoraron ${n.descartados} datos dañados que venían mal escritos.`) : ''}`);
    } catch (err) { alert(`${que} no es una copia de esta app.\n\n` + (err as Error).message) }
  };
  const recuperar = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = '';
    if (file) juntar(await file.text(), 'Ese archivo');
  };
  // Sin archivos: algunos teléfonos o navegadores internos no dejan descargar ni compartir archivos, pero sí texto.
  const enviarTexto = async () => {
    const texto = JSON.stringify(est.db);
    try { await navigator.share({ text: texto }); marcarRespaldo(); render(); return avisar('✅ Copia enviada') }
    catch (e) { if ((e as Error).name === 'AbortError') return }
    try { await navigator.clipboard.writeText(texto); avisar('✅ Copia copiada: péguela en un mensaje') }
    catch { manual.value = texto; manual.classList.remove('hide'); manual.select(); alert('Mantenga el dedo sobre el texto marcado y elija Copiar. Después péguelo en un mensaje.') }
  };
  let archivo!: HTMLInputElement, manual!: HTMLTextAreaElement, pegado!: HTMLTextAreaElement;
  return (
    <details open={!Object.keys(est.db.animales).length}>
      <summary>⚙️ Copia de seguridad</summary>
      <p class="ayuda">Guarde una copia seguido para no perder sus datos si se daña o cambia de teléfono. También sirve para pasar todos los animales a otro teléfono por mensaje.</p>
      <button class="grande" onClick={guardarCopia}>{textoCopia()}</button>
      {/* En el teléfono el botón de arriba abre el menú de compartir; este guarda el archivo en Descargas */}
      {puedeCompartir(archivoCopia()) && <button class="grande" onClick={() => { descargar(archivoCopia(), archivoCopia().name); marcarRespaldo(); render(); avisar('💾 Revise que la copia esté en Descargas') }}>💾 Guardar la copia en este teléfono</button>}
      <button class="grande" onClick={() => archivo.click()}>📂 Recuperar una copia</button>
      <input ref={(el: HTMLInputElement) => (archivo = el)} type="file" accept=".json,.txt,application/json,text/plain" class="hide" onChange={recuperar} />
      {rescatados().map(k => <button class="grande" onClick={() => compartir(new File([localStorage.getItem(k) ?? ''], `ganado-rescatado-${k.slice((KEY + '.danado-').length)}.txt`, { type: 'text/plain' }), 'Datos rescatados')}>🛟 Guardar los datos rescatados</button>)}
      <h3>¿No se puede guardar el archivo?</h3>
      <p class="ayuda">Envíe la copia como texto en un mensaje (a usted mismo o a otro teléfono). Para recuperarla, copie ese mensaje y péguelo abajo.</p>
      <button class="grande" onClick={enviarTexto}>✉️ Enviar la copia como texto</button>
      <textarea class="hide" rows="4" readonly ref={(el: HTMLTextAreaElement) => (manual = el)}></textarea>
      <label for="c-pegar">Pegue aquí una copia recibida como texto</label>
      <textarea id="c-pegar" rows="3" ref={(el: HTMLTextAreaElement) => (pegado = el)}></textarea>
      <button class="grande" onClick={() => pegado.value.trim() ? juntar(pegado.value, 'Ese texto') : alert('Primero pegue el texto de la copia en el cuadro.')}>📥 Recuperar la copia pegada</button>
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
