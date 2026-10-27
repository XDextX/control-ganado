// Mover varios animales de una finca a otra de una sola vez. A cada uno le queda su traslado en el historial.
import { h } from '../jsx';
import { cuantos, fincas, guardar, hoy, porArete, retiro, trasladar } from '../datos';
import { avisar, est, render, volver } from '../estado';
import { NombreYArete } from '../componentes/Arete';

let origen = '';
const marcados = new Set<string>();

export function Mover() {
  const lista = fincas(est.db);
  if (!lista.includes(origen)) { origen = lista[0] ?? ''; marcados.clear() }
  const animales = Object.values(est.db.animales).filter(a => a.finca === origen && !retiro(a)).sort(porArete);
  let boton!: HTMLButtonElement, destino!: HTMLInputElement, fecha!: HTMLInputElement, casillas!: HTMLElement;

  const actualizar = () => {
    const hacia = destino.value.trim(), n = marcados.size;
    boton.disabled = !n || !hacia || hacia === origen;
    boton.textContent = !n ? '🚚 Marque los animales que va a mover'
      : !hacia ? `🚚 Escriba a qué finca van (${cuantos(n, 'animal', 'animales')})`
      : hacia === origen ? '🚚 Elija una finca distinta'
      : `🚚 Mover ${cuantos(n, 'animal', 'animales')} a ${hacia}`;
  };
  const marcarTodos = (si: boolean) => {
    for (const a of animales) si ? marcados.add(a.arete) : marcados.delete(a.arete);
    for (const c of casillas.querySelectorAll('input')) (c as HTMLInputElement).checked = si;
    actualizar();
  };
  const mover = () => {
    const hacia = destino.value.trim(), n = marcados.size;
    for (const arete of marcados) trasladar(est.db.animales[arete], hacia, fecha.value || hoy());
    guardar(est.db); marcados.clear(); volver(); avisar(`🚚 ${cuantos(n, 'animal pasó', 'animales pasaron')} a ${hacia}`);
  };

  return (
    <section>
      <button onClick={() => { marcados.clear(); volver() }}>← Volver</button>
      <h2>🚚 Mover animales a otra finca</h2>
      <label for="m-origen">1. ¿De qué finca salen?</label>
      <select id="m-origen" value={origen} onChange={(e: Event) => { origen = (e.target as HTMLSelectElement).value; marcados.clear(); render() }}>
        {lista.map(f => <option>{f}</option>)}
      </select>
      <label>2. Marque los animales que se van ({cuantos(animales.length, 'animal', 'animales')} en {origen || 'esta finca'})</label>
      <div class="fila">
        <button onClick={() => marcarTodos(true)}>☑️ Marcar todos</button>
        <button onClick={() => marcarTodos(false)}>⬜ Quitar todos</button>
      </div>
      <div ref={(el: HTMLElement) => (casillas = el)}>
        {animales.map(a => (
          <label class="card marcar">
            <input type="checkbox" checked={marcados.has(a.arete)}
              onChange={(e: Event) => { (e.target as HTMLInputElement).checked ? marcados.add(a.arete) : marcados.delete(a.arete); actualizar() }} />
            <span><NombreYArete nombre={a.nombre} arete={a.arete} /><br /><span class="mut">{[a.categoria, a.raza].filter(Boolean).join(' · ')}</span></span>
          </label>
        ))}
      </div>
      <label for="m-destino">3. ¿A qué finca van?</label>
      <input id="m-destino" list="m-fincas" ref={(el: HTMLInputElement) => (destino = el)} onInput={actualizar} placeholder="Elija o escriba el nombre" />
      <datalist id="m-fincas">{lista.filter(f => f !== origen).map(f => <option value={f} />)}</datalist>
      <label for="m-fecha">4. Fecha</label>
      <input id="m-fecha" type="date" value={hoy()} ref={(el: HTMLInputElement) => (fecha = el)} />
      <button class="pri grande" ref={(el: HTMLButtonElement) => { boton = el; queueMicrotask(actualizar) }} onClick={mover}>🚚 Mover</button>
    </section>
  );
}
