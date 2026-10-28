import { h } from '../jsx';
import { cuantos, diasHasta, fusionar, guardar, hoy, marcarRespaldo, ultimoRespaldo } from '../datos';
import { avisar, compartir, est, puedeCompartir, render, volver } from '../estado';

// Como texto (.txt): algunos navegadores de teléfono no dejan compartir archivos .json, pero sí .txt. El contenido es el mismo.
const archivoCopia = () => new File([JSON.stringify(est.db, null, 1)], `ganado-copia-${hoy()}.txt`, { type: 'text/plain' });
export const textoCopia = (cuando = '') => puedeCompartir(archivoCopia()) ? `📲 Enviar una copia ${cuando} (por mensaje)` : `💾 Guardar una copia ${cuando}`;

export async function guardarCopia() {
  const r = await compartir(archivoCopia(), 'Copia de Registro de Ganado');
  if (r === 'cancelado') return;
  marcarRespaldo(); render();
  avisar(r === 'compartido' ? '✅ Copia enviada' : '✅ Copia guardada en Descargas');
}

export function CopiaSeguridad() {
  const recuperar = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = '';
    if (!file) return;
    try {
      const n = fusionar(est.db, JSON.parse(await file.text()));
      guardar(est.db); marcarRespaldo(); volver(); alert(`Copia recuperada.\n\nSe agregaron ${cuantos(n.animales, 'animal nuevo', 'animales nuevos')} y ${cuantos(n.eventos, 'evento nuevo', 'eventos nuevos')}. No se borró nada.${n.descartados ? (n.descartados === 1 ? '\n\nSe ignoró 1 dato dañado que venía mal escrito.' : `\n\nSe ignoraron ${n.descartados} datos dañados que venían mal escritos.`) : ''}`);
    } catch (err) { alert('Ese archivo no es una copia de esta app.\n\n' + (err as Error).message) }
  };
  let archivo!: HTMLInputElement;
  return (
    <details open={!Object.keys(est.db.animales).length}>
      <summary>⚙️ Copia de seguridad</summary>
      <p class="ayuda">Guarde una copia seguido para no perder sus datos si se daña o cambia de teléfono. También sirve para pasar todos los animales a otro teléfono por mensaje.</p>
      <button class="grande" onClick={guardarCopia}>{textoCopia()}</button>
      <button class="grande" onClick={() => archivo.click()}>📂 Recuperar una copia</button>
      <input ref={(el: HTMLInputElement) => (archivo = el)} type="file" accept=".json,.txt,application/json,text/plain" class="hide" onChange={recuperar} />
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
