// Mover varios animales de una finca a otra de una sola vez. A cada uno le queda su traslado en el historial.
import { h } from '../jsx';
import { cuantos, fincas, hoy, porArete, retiro, trasladar } from '../datos';
import { est, guardarYAvisar, render, volver } from '../estado';
import { NombreYArete } from '../componentes/Arete';

let origen = '', categoria = ''; // categoria '' = todas
const marcados = new Set<string>();

export function Mover() {
  const lista = fincas(est.db);
  if (!lista.includes(origen)) { origen = lista[0] ?? ''; categoria = ''; marcados.clear() }
  const enFinca = Object.values(est.db.animales).filter(a => a.finca === origen && !retiro(a)).sort(porArete);
  // Una marca vieja (el animal se eliminó o ya se movió, y se salió con el "atrás" del teléfono) no debe mover nada.
  for (const m of marcados) if (!enFinca.some(a => a.arete === m)) marcados.delete(m);
  const categorias = [...new Set(enFinca.map(a => a.categoria || 'Sin categoría'))];
  // Solo se ven (y se marcan con "Marcar todos") los de la categoría elegida; lo ya marcado en otra categoría se conserva.
  const animales = enFinca.filter(a => !categoria || (a.categoria || 'Sin categoría') === categoria);
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
    marcados.clear(); volver(); guardarYAvisar(`🚚 ${cuantos(n, 'animal pasó', 'animales pasaron')} a ${hacia}`);
  };

  return (
    <section>
      <button onClick={() => { marcados.clear(); volver() }}>← Volver</button>
      <h2>🚚 Mover animales a otra finca</h2>
      <label for="m-origen">1. ¿De qué finca salen?</label>
      <select id="m-origen" value={origen} onChange={(e: Event) => { origen = (e.target as HTMLSelectElement).value; categoria = ''; marcados.clear(); render() }}>
        {lista.map(f => <option>{f}</option>)}
      </select>
      <label>2. Marque los animales que se van ({cuantos(animales.length, 'animal', 'animales')}{categoria ? ' · ' + categoria : ''} en {origen || 'esta finca'})</label>
      {categorias.length > 1 && <div class="filtros">
        {['', ...categorias].map(c => <button aria-pressed={String(categoria === c)} onClick={() => { categoria = c; render() }}>{c || 'Todos'}</button>)}
      </div>}
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
      <input id="m-destino" maxlength="80" list="m-fincas" ref={(el: HTMLInputElement) => (destino = el)} onInput={actualizar} placeholder="Elija o escriba el nombre" />
      <datalist id="m-fincas">{lista.filter(f => f !== origen).map(f => <option value={f} />)}</datalist>
      <label for="m-fecha">4. Fecha</label>
      <input id="m-fecha" type="date" value={hoy()} ref={(el: HTMLInputElement) => (fecha = el)} />
      <button class="pri grande" ref={(el: HTMLButtonElement) => { boton = el; queueMicrotask(actualizar) }} onClick={mover}>🚚 Mover</button>
    </section>
  );
}
