// Planilla del día de pesaje: las vacas de leche de una finca que se van a pesar, con mañana y tarde en kilos.
import { h, Fragment } from '../jsx';
import { Animal, Evento, MAX_KILOS, REGLA_CONCENTRADO, buscar, concentrado, cuantos, esRaro, fincas, fmt, guardarPesajes, hoy, kilos, leerKilos, pesajeAnterior, pesajeDe, totalPesaje, vacasDeLeche } from '../datos';
import { avisarError, est, guardarYAvisar, ir, mostrarReporte, render, volver } from '../estado';
import { NombreYArete } from '../componentes/Arete';
import { Ordenos } from '../componentes/Ordenos';

// Lo escrito y sin guardar (por día, vaca y ordeño) y las vacas añadidas a mano (por finca y día, la última primero).
// Se guarda por pestaña, como la pantalla (ver restaurarPantalla): si el teléfono cierra la app al cambiar a otra, al volver sigue ahí.
const BORRADOR = 'ganado.pesaje-sin-guardar';
function leerBorrador() {
  try {
    const d = JSON.parse(sessionStorage.getItem(BORRADOR) ?? '{}');
    const pares = (x: unknown) => Array.isArray(x) ? x.filter((p): p is [string, unknown] => Array.isArray(p) && typeof p[0] === 'string') : [];
    return {
      b: new Map(pares(d.b).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 20)])),
      n: new Map(pares(d.n).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).filter(x => typeof x === 'string') as string[]])),
    };
  } catch { return { b: new Map<string, string>(), n: new Map<string, string[]>() } }
}
// Lo escrito en el ejemplo va aparte y se borra al salir de él: nunca se mezcla con los datos reales.
const reales = leerBorrador(), deEjemplo = { b: new Map<string, string>(), n: new Map<string, string[]>() };
let { b: borradores, n: anadidas } = reales, dbDelEjemplo: unknown = null;
function elegirBorrador() {
  // Cada vez que se entra al ejemplo hay un hato nuevo: lo escrito en el anterior se descarta.
  if (est.ejemplo && est.db !== dbDelEjemplo) { deEjemplo.b.clear(); deEjemplo.n.clear(); dbDelEjemplo = est.db }
  ({ b: borradores, n: anadidas } = est.ejemplo ? deEjemplo : reales);
}
const areteDe = (k: string) => k.slice(11, k.lastIndexOf('|')); // clave = 'AAAA-MM-DD|arete|am' (el arete puede llevar «|»)
const guardarBorrador = () => { if (est.ejemplo) return; try { sessionStorage.setItem(BORRADOR, JSON.stringify({ b: [...reales.b].filter(([, v]) => v), n: [...reales.n] })) } catch { /* sin espacio: queda en memoria */ } };
const clave = (dia: string, arete: string, ordeno: string) => `${dia}|${arete}|${ordeno}`;
let buscado = ''; // sigue al cambiar de finca o de fecha; al entrar a la pantalla empieza vacío
const MAX_RESULTADOS = 5;
export const abrirPesaje = () => { buscado = ''; ir('pesaje') };

// Fincas que tienen vacas de leche para pesar.
const fincasDeLeche = () => fincas(est.db).filter(f => vacasDeLeche(est.db, f).length);

// Al abrir, la hoja trae las vacas del último pesaje de la finca, más las que ya tienen pesaje o kilos escritos ese día.
function deEntrada(vacas: Animal[], fecha: string) {
  const ultima = vacas.map(a => pesajeAnterior(a, fecha)?.fecha ?? '').reduce((x, y) => (y > x ? y : x), '');
  const tiene = (a: Animal, ...dias: string[]) => a.eventos.some(e => e.tipo === 'pesaje' && dias.includes(e.fecha));
  return vacas.filter(a => tiene(a, ultima, fecha) || ['am', 'pm'].some(o => borradores.get(clave(fecha, a.arete, o)))).map(a => a.arete);
}

export function Pesaje() {
  elegirBorrador();
  const pl = est.planilla, lista = fincasDeLeche();
  if (!lista.includes(pl.finca)) pl.finca = lista[0] ?? '';
  if (pl.elegidaEl !== hoy()) { pl.fecha = hoy(); pl.elegidaEl = hoy() }
  const { finca, fecha } = pl;
  const vacas = vacasDeLeche(est.db, finca), deLaFinca = new Map(vacas.map(v => [v.a.arete, v]));
  const extra = (anadidas.get(`${finca}|${fecha}`) ?? []).filter(x => deLaFinca.has(x));
  const enHoja = [...new Set([...extra, ...deEntrada(vacas.map(v => v.a), fecha)])].map(x => deLaFinca.get(x)!);
  const filas: { arete: string; am: HTMLInputElement; pm: HTMLInputElement; total: HTMLElement; antes?: Evento }[] = [];
  let resumen!: HTMLElement, resultados!: HTMLElement, nada!: HTMLElement;

  // Tocar una vaca de la búsqueda la pone arriba de la hoja con el teclado listo en «Mañana»; si ya estaba, solo va a ella.
  const anadir = (arete: string) => {
    if (!enHoja.some(v => v.a.arete === arete)) { anadidas.set(`${finca}|${fecha}`, [arete, ...extra]); guardarBorrador() }
    buscado = ''; render();
    const am = document.querySelector<HTMLInputElement>(`[data-arete="${CSS.escape(arete)}"] input`);
    am?.focus({ preventScroll: true }); am?.closest('.card')?.scrollIntoView({ block: 'start' });
  };
  const Resultados = () => {
    const hallados = buscar(vacas.map(v => v.a), buscado).map(a => deLaFinca.get(a.arete)!);
    // Texto fijo: el lector de pantalla no repite lo buscado con cada tecla.
    queueMicrotask(() => { nada.textContent = buscado.trim() && !hallados.length ? 'No hay ninguna vaca de leche con esos números o ese nombre en esta finca.' : '' });
    if (!hallados.length) return null;
    return <>
      {hallados.slice(0, MAX_RESULTADOS).map(({ a }) => <button class="grande" onClick={() => anadir(a.arete)}>
        {enHoja.some(v => v.a.arete === a.arete) ? '✏️' : '➕'} <NombreYArete nombre={a.nombre} arete={a.arete} />
        {enHoja.some(v => v.a.arete === a.arete) && <span class="mut"> · ya está en la hoja</span>}
      </button>)}
      {hallados.length > MAX_RESULTADOS && <p class="mut">Hay {hallados.length - MAX_RESULTADOS} más: escriba más números.</p>}
    </>;
  };

  const valor = (i: HTMLInputElement) => { const n = leerKilos(i.value); i.classList.toggle('malo', Number.isNaN(n)); return n };
  const recalcular = () => {
    let suma = 0, conc = 0, pesadas = 0, raros = 0;
    for (const f of filas) {
      const am = valor(f.am), pm = valor(f.pm);
      for (const [i, n, antes] of [[f.am, am, f.antes?.am], [f.pm, pm, f.antes?.pm]] as const) {
        const raro = esRaro(n, antes);
        i.classList.toggle('raro', raro); raros += +raro;
      }
      const t = (Number.isNaN(am) ? 0 : am ?? 0) + (Number.isNaN(pm) ? 0 : pm ?? 0);
      // Un número en rojo no cuenta como ordeño pesado: el aviso sale si solo uno de los dos es válido.
      const validos = [am, pm].filter(n => n !== undefined && !Number.isNaN(n)).length;
      f.total.textContent = am === undefined && pm === undefined ? '' : `= ${kilos(t)} · 🌾 ${kilos(concentrado(t))} de concentrado${validos === 1 ? ' (solo con un ordeño)' : ''}`;
      if (t) { suma += t; conc += concentrado(t); pesadas++ }
    }
    resumen.textContent = (pesadas ? `${cuantos(pesadas, 'vaca pesada', 'vacas pesadas')} · total ${kilos(suma)} · 🌾 concentrado ${kilos(conc)}` : 'Todavía no hay pesos anotados.')
      + (raros ? ` · ⚠️ ${cuantos(raros, 'número muy distinto', 'números muy distintos')} a la vez pasada (en amarillo): revíselos` : '');
  };
  // La tecla "Siguiente" del teclado pasa al próximo cuadro (mañana → tarde → siguiente vaca); en el último, cierra el teclado.
  const siguiente = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const todos = filas.flatMap(f => [f.am, f.pm]), i = todos.indexOf(e.target as HTMLInputElement);
    todos[i + 1] ? todos[i + 1].focus() : (e.target as HTMLInputElement).blur();
  };
  const guardarTodo = () => {
    const malos = filas.filter(f => Number.isNaN(valor(f.am)) || Number.isNaN(valor(f.pm)));
    if (malos.length) {
      // La planilla es larga: el foco va al primer número malo, no al aviso de arriba (se anuncia igual).
      avisarError(`Revise los números en rojo (${malos.length}). Use solo números, por ejemplo 12,5. Máximo ${MAX_KILOS} kg por ordeño.`, { foco: false });
      return document.querySelector<HTMLInputElement>('input.malo')?.focus();
    }
    const n = guardarPesajes(est.db, fecha, filas.map(f => ({ arete: f.arete, am: valor(f.am), pm: valor(f.pm) })));
    if (!guardarYAvisar(`✅ Pesaje guardado: ${cuantos(n, 'vaca', 'vacas')}`)) return;
    for (const f of filas) for (const o of ['am', 'pm']) borradores.delete(clave(fecha, f.arete, o));
    anadidas.delete(`${finca}|${fecha}`); guardarBorrador(); buscado = '';
    est.mes = fecha.slice(0, 7); est.fechaPesaje = fecha; mostrarReporte('pesajes');
  };

  const deEstaHoja = new Set(enHoja.flatMap(({ a }) => ['am', 'pm'].map(o => clave(fecha, a.arete, o))));
  // Kilos de una vaca que ya no es de leche no tienen hoja donde verse: no avisan, pero no se borran (si la base cargó mal, vuelven al arreglarla).
  const deLeche = new Set(lista.flatMap(f => vacasDeLeche(est.db, f).map(v => v.a.arete)));
  const otrosDias = [...new Set([...borradores].filter(([k, v]) => v && !deEstaHoja.has(k) && deLeche.has(areteDe(k))).map(([k]) => k.slice(0, 10)))].sort();

  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>🥛 Pesaje de leche</h2>
      {otrosDias.length > 0 && <p class="card warn">⚠️ Tiene kilos escritos sin guardar en otra finca o fecha ({otrosDias.map(d => fmt(d)).join(', ')}). Vuelva a esa hoja y toque Guardar.</p>}
      {!lista.length ? <p>No hay vacas de leche registradas. Para pesarlas, en su ficha el <b>Tipo</b> debe ser “Leche” y la categoría “Vaca”.</p> : <>
        <label for="p-finca">Finca</label>
        <select id="p-finca" value={finca} onChange={(e: Event) => { pl.finca = (e.target as HTMLSelectElement).value; render() }}>
          {lista.map(f => <option>{f}</option>)}
        </select>
        <label for="p-fecha">Fecha del pesaje</label>
        <input id="p-fecha" type="date" value={fecha} onChange={(e: Event) => { pl.fecha = (e.target as HTMLInputElement).value || hoy(); render() }} />
        <p class="ayuda">Anote los kilos de cada ordeño. Deje en blanco la vaca que no se pesó. Al lado sale el concentrado que le toca: {REGLA_CONCENTRADO}. Si ya había pesaje ese día, aquí aparece para corregirlo.</p>
        <label for="p-buscar">➕ Añadir una vaca (últimos números del arete o nombre)</label>
        <input id="p-buscar" type="search" placeholder="Ej.: 4521 o Lucera" value={buscado}
          onInput={(e: Event) => { buscado = (e.target as HTMLInputElement).value; resultados.replaceChildren(<Resultados />) }} />
        <p class="mut" role="status" ref={(el: HTMLElement) => (nada = el)}></p>
        <div ref={(el: HTMLElement) => (resultados = el)}><Resultados /></div>
        {!enHoja.length && <p class="mut">Todavía no hay vacas en esta hoja. Busque cada vaca arriba y tóquela para añadirla.</p>}
        {enHoja.map(({ a, seca }) => {
          const p = pesajeDe(a, fecha), antes = pesajeAnterior(a, fecha);
          const coma = (n?: number) => String(n ?? '').replace('.', ',');
          let am!: HTMLInputElement, pm!: HTMLInputElement, total!: HTMLElement;
          const escribir = (o: string) => (e: Event) => { borradores.set(clave(fecha, a.arete, o), (e.target as HTMLInputElement).value); guardarBorrador(); recalcular() };
          const fila = (
            <div class={'card pesaje' + (seca ? ' seca' : '')} data-arete={a.arete}>
              <div><NombreYArete nombre={a.nombre} arete={a.arete} />{seca && <span class="tag">Seca</span>} <b class="total" ref={(el: HTMLElement) => (total = el)}></b></div>
              <p class="ayuda">{antes ? <>La vez pasada (<span class="nw">{fmt(antes.fecha)}</span>): <span class="nw">{kilos(totalPesaje(antes))}</span> — <Ordenos e={antes} /></> : 'Primer pesaje de esta vaca.'}</p>
              <div class="fila">
                <label>☀️ Mañana (kg)<input inputmode="decimal" enterkeyhint="next" value={borradores.get(clave(fecha, a.arete, 'am')) ?? coma(p?.am)} ref={(el: HTMLInputElement) => (am = el)} onInput={escribir('am')} onKeyDown={siguiente} /></label>
                <label>🌙 Tarde (kg)<input inputmode="decimal" enterkeyhint="next" value={borradores.get(clave(fecha, a.arete, 'pm')) ?? coma(p?.pm)} ref={(el: HTMLInputElement) => (pm = el)} onInput={escribir('pm')} onKeyDown={siguiente} /></label>
              </div>
            </div>
          );
          filas.push({ arete: a.arete, am, pm, total, antes });
          return fila;
        })}
        {/* El total queda al final de la hoja; Guardar va fijo abajo, siempre a la vista */}
        <p><b ref={(el: HTMLElement) => { resumen = el; queueMicrotask(recalcular) }}></b></p>
        <div class="barra-guardar">
          <button class="pri grande" onClick={guardarTodo}>💾 Guardar pesaje</button>
        </div>
      </>}
    </section>
  );
}
