import { h, Fragment } from '../jsx';
import { Animal, alertas, cuantos, diasHasta, fincas, fmt, porArete, prenezAbierta, retiro } from '../datos';
import { abrir, est, ir, render } from '../estado';
import { AvisoRespaldo, CopiaSeguridad } from '../componentes/CopiaSeguridad';
import { EliminarDatos } from '../componentes/EliminarDatos';
import { Comentarios } from '../componentes/Comentarios';
import { NombreYArete } from '../componentes/Arete';

// Texto corto de un aviso: "parto en 4 días", "secado atrasado 56 días".
const textoAviso = (que: string, d: number) => que === 'Secar'
  ? (d < 0 ? `secado atrasado ${cuantos(-d, 'día', 'días')}` : d === 0 ? 'secar hoy' : `secar en ${cuantos(d, 'día', 'días')}`)
  : (d < 0 ? `parto atrasado ${cuantos(-d, 'día', 'días')} (¿ya parió?)` : d === 0 ? 'parto hoy' : `parto en ${cuantos(d, 'día', 'días')}`);

// Un renglón por animal, con todo lo que le toca.
function Alertas() {
  const al = alertas(est.db);
  if (!al.length) return null;
  const porAnimal = new Map<string, typeof al>();
  for (const x of al) porAnimal.set(x.a.arete, [...(porAnimal.get(x.a.arete) ?? []), x]);
  return (
    <div class="card"><h2>⚠️ Próximos 30 días</h2>
      <p class="ayuda">Toque un animal para anotar lo que pasó.</p>
      <ul>
        {[...porAnimal.values()].map(xs => (
          <li class="ev item" onClick={() => abrir(xs[0].a.arete)}>
            <span><NombreYArete nombre={xs[0].a.nombre} arete={xs[0].a.arete} /><br />
              {xs.map((x, i) => { const d = diasHasta(x.f); return <>{i ? ' · ' : ''}<span class={d < 0 ? 'bad' : 'warn'}>{textoAviso(x.que, d)}</span></> })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const POR_PAGINA = 15;

// Botones grandes de Anterior/Siguiente; `cambiar` vuelve a pintar solo la lista.
function Paginas({ total, cambiar }: { total: number; cambiar: () => void }) {
  const paginas = Math.ceil(total / POR_PAGINA);
  if (paginas <= 1) return null;
  const ir = (p: number) => { est.pagina = p; cambiar(); document.getElementById('lista')?.scrollIntoView() };
  return (
    <div class="paginas">
      <button class="grande" disabled={est.pagina === 0} onClick={() => ir(est.pagina - 1)}>← Anterior</button>
      <span><b>Página {est.pagina + 1} de {paginas}</b><br /><span class="mut">{total} animales</span></span>
      <button class="grande" disabled={est.pagina >= paginas - 1} onClick={() => ir(est.pagina + 1)}>Siguiente →</button>
    </div>
  );
}

function Tarjeta({ a }: { a: Animal }) {
  const r = retiro(a), p = prenezAbierta(a);
  return (
      <div class="card item" onClick={() => abrir(a.arete)}>
        <span><NombreYArete nombre={a.nombre} arete={a.arete} /><br />
          <span class="mut">{[a.finca, a.categoria, a.raza, a.tipo === 'leche' ? 'Leche' : 'Carne'].filter(Boolean).join(' · ')} · {cuantos(a.eventos.length, 'evento', 'eventos')}</span>
        </span>
        <span>{r ? <span class="tag bad">{r.motivo}</span> : p ? <span class="tag">Preñada · parto {fmt(p.parto)}</span> : null}</span>
      </div>
  );
}

// Resultados de la búsqueda, justo debajo del buscador (incluye vendidos y todas las fincas: se busca un animal concreto).
function Resultados() {
  const q = est.filtro.q.trim().toLowerCase();
  if (!q) return null;
  const hallados = Object.values(est.db.animales)
    .filter(a => a.arete.toLowerCase().includes(q) || (a.nombre || '').toLowerCase().includes(q)).sort(porArete);
  if (!hallados.length) return <p class="mut">No se encontró ningún animal con “{est.filtro.q.trim()}”. Revise el número.</p>;
  return <>
    {hallados.slice(0, POR_PAGINA).map(a => <Tarjeta a={a} />)}
    {hallados.length > POR_PAGINA && <p class="mut">Hay {hallados.length - POR_PAGINA} más: escriba más números para encontrarlo.</p>}
  </>;
}

// Lista completa por finca, con páginas.
function Tarjetas({ cambiar }: { cambiar: () => void }) {
  const { db, filtro } = est;
  const lista = Object.values(db.animales)
    .filter(a => (filtro.verRet || !retiro(a)) && (!filtro.finca || a.finca === filtro.finca))
    .sort(porArete);
  if (!lista.length) return <p class="mut">{!Object.keys(db.animales).length ? 'Aún no hay animales. Toque “➕ Agregar un animal”.'
    : filtro.finca ? 'No hay animales en esta finca. Elija “Todas las fincas”.'
    : 'No hay animales activos. Los vendidos o muertos se ven con el botón de arriba.'}</p>;
  est.pagina = Math.min(est.pagina, Math.ceil(lista.length / POR_PAGINA) - 1);
  const pagina = lista.slice(est.pagina * POR_PAGINA, (est.pagina + 1) * POR_PAGINA);
  return <>{pagina.map(a => <Tarjeta a={a} />)}<Paginas total={lista.length} cambiar={cambiar} /></>;
}

export function Lista() {
  const { db, filtro } = est, hay = Object.keys(db.animales).length > 0;
  let cont!: HTMLElement, resultados!: HTMLElement;
  const pintar = () => cont.replaceChildren(<Tarjetas cambiar={pintar} />);
  const filtrar = () => { est.pagina = 0; pintar() }; // al cambiar de finca, volver a la primera página
  return (
    <section>
      {!hay && <div class="card">
        <h2>👋 Hola</h2>
        <p>Para empezar, toque <b>“➕ Agregar un animal”</b>.</p>
        <p>Si ya tiene una copia de sus datos, toque <b>“📂 Recuperar una copia”</b>, al final de esta pantalla.</p>
      </div>}
      <button class="pri grande" onClick={() => ir('escaner')}>📷 Escanear código QR</button>
      <button class="pri grande" onClick={() => abrir(null)}>➕ Agregar un animal</button>
      {hay && <>
        <label for="buscar">🔍 Buscar animal (últimos números del arete o nombre)</label>
        <input id="buscar" type="search" placeholder="Ej.: 6921 o Lucera" value={filtro.q}
          onInput={(e: Event) => { filtro.q = (e.target as HTMLInputElement).value; resultados.replaceChildren(<Resultados />) }} />
        <div ref={(el: HTMLElement) => (resultados = el)}><Resultados /></div>
      </>}
      <div class="fila">
        {hay && <button onClick={() => ir('cambios')}>📲 Pasar lo anotado</button>}
        {fincas(db).length > 0 && <button onClick={() => ir('mover')}>🚚 Mover animales</button>}
        <button onClick={() => ir('reportes')}>📋 Reportes</button>
      </div>
      <AvisoRespaldo />
      <Alertas />
      <h2>Mis animales</h2>
      <label for="finca">Finca</label>
      <select id="finca" value={filtro.finca} onChange={(e: Event) => { filtro.finca = (e.target as HTMLSelectElement).value; filtrar() }}>
        <option value="">Todas las fincas</option>
        {fincas(db).map(f => <option>{f}</option>)}
      </select>
      {Object.values(db.animales).some(retiro) && <button class="grande" onClick={() => { filtro.verRet = !filtro.verRet; est.pagina = 0; render() }}>
        {filtro.verRet ? '🙈 Ocultar animales vendidos o muertos' : '👁️ Ver también animales vendidos o muertos'}
      </button>}
      <div id="lista" ref={(el: HTMLElement) => (cont = el)}><Tarjetas cambiar={pintar} /></div>
      <CopiaSeguridad />
      {hay && <EliminarDatos />}
      <Comentarios />
    </section>
  );
}
