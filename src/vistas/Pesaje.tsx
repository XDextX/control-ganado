// Planilla del día de pesaje: todas las vacas de leche de una finca, con mañana y tarde en kilos.
import { h, Fragment } from '../jsx';
import { Evento, MAX_KILOS, cuantos, esRaro, fincas, fmt, guardarPesajes, hoy, kilos, leerKilos, pesajeAnterior, pesajeDe, totalPesaje, vacasDeLeche } from '../datos';
import { est, guardarYAvisar, mostrarReporte, render, volver } from '../estado';
import { NombreYArete } from '../componentes/Arete';

const borradores = new Map<string, string>(); // lo escrito y sin guardar, por día, vaca y ordeño: sobrevive a cambiar de finca, de fecha o de pantalla
const clave = (dia: string, arete: string, ordeno: string) => `${dia}|${arete}|${ordeno}`;
let finca = '', fecha = '', elegidaEl = ''; // elegidaEl: día en que se eligió la fecha (la app puede quedar abierta varios días)

// Fincas que tienen vacas de leche para pesar.
const fincasDeLeche = () => fincas(est.db).filter(f => vacasDeLeche(est.db, f).length);

export function Pesaje() {
  const lista = fincasDeLeche();
  if (!lista.includes(finca)) finca = lista[0] ?? '';
  if (elegidaEl !== hoy()) { fecha = hoy(); elegidaEl = hoy() }
  const vacas = vacasDeLeche(est.db, finca);
  const filas: { arete: string; am: HTMLInputElement; pm: HTMLInputElement; total: HTMLElement; antes?: Evento }[] = [];
  let resumen!: HTMLElement;

  const valor = (i: HTMLInputElement) => { const n = leerKilos(i.value); i.classList.toggle('malo', Number.isNaN(n)); return n };
  const recalcular = () => {
    let suma = 0, pesadas = 0, raros = 0;
    for (const f of filas) {
      const am = valor(f.am), pm = valor(f.pm);
      for (const [i, n, antes] of [[f.am, am, f.antes?.am], [f.pm, pm, f.antes?.pm]] as const) {
        const raro = esRaro(n, antes);
        i.classList.toggle('raro', raro); raros += +raro;
      }
      const t = (Number.isNaN(am) ? 0 : am ?? 0) + (Number.isNaN(pm) ? 0 : pm ?? 0);
      f.total.textContent = am === undefined && pm === undefined ? '' : '= ' + kilos(t);
      if (t) { suma += t; pesadas++ }
    }
    resumen.textContent = (pesadas ? `${cuantos(pesadas, 'vaca pesada', 'vacas pesadas')} · total ${kilos(suma)}` : 'Todavía no hay pesos anotados.')
      + (raros ? ` · ⚠️ ${cuantos(raros, 'número muy distinto', 'números muy distintos')} a la vez pasada (en amarillo): revíselos` : '');
  };
  // La tecla "Siguiente" del teclado pasa al próximo cuadro (mañana → tarde → siguiente vaca).
  const siguiente = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const todos = filas.flatMap(f => [f.am, f.pm]), i = todos.indexOf(e.target as HTMLInputElement);
    todos[i + 1] ? todos[i + 1].focus() : (e.target as HTMLInputElement).blur();
  };
  const guardarTodo = () => {
    const malos = filas.filter(f => Number.isNaN(valor(f.am)) || Number.isNaN(valor(f.pm)));
    if (malos.length) return alert(`Revise los números en rojo (${malos.length}). Use solo números, por ejemplo 12,5. Máximo ${MAX_KILOS} kg por ordeño.`);
    const n = guardarPesajes(est.db, fecha, filas.map(f => ({ arete: f.arete, am: valor(f.am), pm: valor(f.pm) })));
    if (!guardarYAvisar(`✅ Pesaje guardado: ${cuantos(n, 'vaca', 'vacas')}`)) return;
    for (const f of filas) for (const o of ['am', 'pm']) borradores.delete(clave(fecha, f.arete, o));
    est.mes = fecha.slice(0, 7); est.fechaPesaje = fecha; mostrarReporte('pesajes');
  };

  const deEstaHoja = new Set(vacas.flatMap(({ a }) => ['am', 'pm'].map(o => clave(fecha, a.arete, o))));
  const otrosDias = [...new Set([...borradores].filter(([k, v]) => v && !deEstaHoja.has(k)).map(([k]) => k.slice(0, 10)))].sort();

  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>🥛 Pesaje de leche</h2>
      {otrosDias.length > 0 && <p class="card warn">⚠️ Tiene kilos escritos sin guardar en otra finca o fecha ({otrosDias.map(d => fmt(d)).join(', ')}). Vuelva a esa hoja y toque Guardar.</p>}
      {!lista.length ? <p>No hay vacas de leche registradas. Para pesarlas, en su ficha el <b>Tipo</b> debe ser “Leche” y la categoría “Vaca”.</p> : <>
        <label for="p-finca">Finca</label>
        <select id="p-finca" value={finca} onChange={(e: Event) => { finca = (e.target as HTMLSelectElement).value; render() }}>
          {lista.map(f => <option>{f}</option>)}
        </select>
        <label for="p-fecha">Fecha del pesaje</label>
        <input id="p-fecha" type="date" value={fecha} onChange={(e: Event) => { fecha = (e.target as HTMLInputElement).value || hoy(); render() }} />
        <p class="ayuda">Anote los kilos de cada ordeño. Deje en blanco la vaca que no se pesó. Si ya había pesaje ese día, aquí aparece para corregirlo.</p>
        {vacas.map(({ a, seca }) => {
          const p = pesajeDe(a, fecha), antes = pesajeAnterior(a, fecha);
          const coma = (n?: number) => String(n ?? '').replace('.', ',');
          let am!: HTMLInputElement, pm!: HTMLInputElement, total!: HTMLElement;
          const escribir = (o: string) => (e: Event) => { borradores.set(clave(fecha, a.arete, o), (e.target as HTMLInputElement).value); recalcular() };
          const fila = (
            <div class={'card pesaje' + (seca ? ' seca' : '')}>
              <div><NombreYArete nombre={a.nombre} arete={a.arete} />{seca && <span class="tag">Seca</span>} <b class="total" ref={(el: HTMLElement) => (total = el)}></b></div>
              <p class="ayuda">{antes ? `La vez pasada (${fmt(antes.fecha)}): ${kilos(totalPesaje(antes))} — ☀️ ${kilos(antes.am ?? 0)} · 🌙 ${kilos(antes.pm ?? 0)}` : 'Primer pesaje de esta vaca.'}</p>
              <div class="fila">
                <label>☀️ Mañana (kg)<input inputmode="decimal" enterkeyhint="next" value={borradores.get(clave(fecha, a.arete, 'am')) ?? coma(p?.am)} ref={(el: HTMLInputElement) => (am = el)} onInput={escribir('am')} onKeyDown={siguiente} /></label>
                <label>🌙 Tarde (kg)<input inputmode="decimal" enterkeyhint="next" value={borradores.get(clave(fecha, a.arete, 'pm')) ?? coma(p?.pm)} ref={(el: HTMLInputElement) => (pm = el)} onInput={escribir('pm')} onKeyDown={siguiente} /></label>
              </div>
            </div>
          );
          filas.push({ arete: a.arete, am, pm, total, antes });
          return fila;
        })}
        {/* Barra fija abajo: el total y Guardar siempre a la vista, sin bajar hasta el final */}
        <div class="barra-guardar">
          <p><b ref={(el: HTMLElement) => { resumen = el; queueMicrotask(recalcular) }}></b></p>
          <button class="pri grande" onClick={guardarTodo}>💾 Guardar pesaje</button>
        </div>
      </>}
    </section>
  );
}
