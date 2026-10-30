import { h } from '../jsx';
import { Animal, KEY, cuantos, diceBorrar, rescatados } from '../datos';
import { avisar, est, guardarYAvisar, volver } from '../estado';
import { guardarCopia, textoCopia } from './CopiaSeguridad';

// Acción destructiva: advertencia y escribir BORRAR. La confirmación va dentro de la pantalla, no en ventanitas
// del navegador: el navegador interno de las apps de mensajería puede bloquear confirm()/prompt(), y el autocorrector cambia lo escrito.
export function ConfirmarBorrado({ boton, aviso, alConfirmar }: { boton: string; aviso: string; alConfirmar: () => void }) {
  let caja!: HTMLElement, abrirBtn!: HTMLElement, si!: HTMLButtonElement, campo!: HTMLInputElement;
  const mostrar = (ver: boolean) => {
    caja.classList.toggle('hide', !ver); abrirBtn.classList.toggle('hide', ver);
    if (ver) { campo.value = ''; si.disabled = true; campo.focus() }
  };
  return (
    <div>
      <button class="grande peligro" ref={(el: HTMLElement) => (abrirBtn = el)} onClick={() => mostrar(true)}>{boton}</button>
      <div class="card hide confirmar" ref={(el: HTMLElement) => (caja = el)}>
        <p class="bad"><b>⚠️ {aviso}</b></p>
        <p><b>Esto NO se puede deshacer.</b></p>
        <label for="f-borrar">Para confirmar, escriba la palabra BORRAR</label>
        <input id="f-borrar" ref={(el: HTMLInputElement) => (campo = el)} autocomplete="off" autocapitalize="characters" spellcheck="false"
          onInput={() => (si.disabled = !diceBorrar(campo.value))} />
        <button class="grande peligro" disabled ref={(el: HTMLButtonElement) => (si = el)} onClick={alConfirmar}>🗑️ Sí, borrar para siempre</button>
        <button class="grande" onClick={() => { mostrar(false); avisar('No se borró nada') }}>✋ No, cancelar</button>
      </div>
    </div>
  );
}

export function EliminarDatos() {
  const n = Object.keys(est.db.animales).length;
  const borrarTodo = () => {
    est.db = { animales: {} };
    try { for (const k of [KEY + '.respaldo', ...rescatados()]) localStorage.removeItem(k) } catch { /* sin almacenamiento */ }
    est.filtro.q = ''; est.filtro.finca = ''; est.filtro.verRet = false;
    volver(); guardarYAvisar('🗑️ Se borraron todos los datos');
  };
  return (
    <details class="peligro">
      <summary>🗑️ Eliminar datos</summary>
      <p><b>⚠️ Cuidado: esto borra información para siempre y no se puede deshacer.</b></p>
      <p class="ayuda">Antes de borrar, guarde una copia por si la necesita después.</p>
      <button class="grande" onClick={guardarCopia}>{textoCopia('primero')}</button>
      <p class="ayuda">Para borrar un solo animal, ábralo y use “🗑️ Eliminar este animal” al final de su ficha.</p>
      <ConfirmarBorrado boton="🗑️ Borrar TODOS los datos de este teléfono" alConfirmar={borrarTodo}
        aviso={`Va a borrar TODOS los datos de este teléfono: ${cuantos(n, 'animal', 'animales')} con todo su historial. Se perderá todo lo que no esté en una copia.`} />
    </details>
  );
}

export function EliminarAnimal({ a }: { a: Animal }) {
  const eliminar = () => { delete est.db.animales[a.arete]; volver(); guardarYAvisar('🗑️ Animal eliminado') };
  return (
    <details class="peligro">
      <summary>🗑️ Eliminar este animal</summary>
      <p><b>⚠️ Cuidado: borra el animal y todo su historial para siempre. No se puede deshacer.</b></p>
      <p class="ayuda">Si se vendió o murió, no lo elimine: use “Otro → 💰 Vendido / ✝️ Murió” para que quede el registro.</p>
      <ConfirmarBorrado boton={`🗑️ Eliminar el animal ${a.arete}`} alConfirmar={eliminar}
        aviso={`Va a eliminar el animal ${a.arete}${a.nombre ? ' (' + a.nombre + ')' : ''} con todo su historial.`} />
    </details>
  );
}
