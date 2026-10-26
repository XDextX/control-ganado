import { h, Fragment } from '../jsx';
import { alertas, cuantos, diasHasta, fincas, fmt, porArete, prenezAbierta, retiro } from '../datos';
import { abrir, est, ir, render } from '../estado';
import { AvisoRespaldo, CopiaSeguridad } from '../componentes/CopiaSeguridad';
import { EliminarDatos } from '../componentes/EliminarDatos';
import { Comentarios } from '../componentes/Comentarios';

function Alertas() {
  const al = alertas(est.db);
  if (!al.length) return null;
  return (
    <div class="card"><h2>⚠️ Próximos 30 días</h2><ul>
      {al.map(x => {
        const d = diasHasta(x.f);
        return (
          <li class="ev item" onClick={() => abrir(x.a.arete)}>
            <span><b>{x.que}</b> · {x.a.arete} {x.a.nombre}</span>
            <span class={d < 0 ? 'bad' : 'warn'}>{fmt(x.f)} ({d < 0 ? 'hace ' + -d : 'en ' + d} días)</span>
          </li>
        );
      })}
    </ul></div>
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

function Tarjetas({ cambiar }: { cambiar: () => void }) {
  const { db, filtro } = est, q = filtro.q.trim().toLowerCase();
  const lista = Object.values(db.animales)
    .filter(a => (filtro.verRet || !retiro(a)) && (!filtro.finca || a.finca === filtro.finca) &&
      (!q || a.arete.toLowerCase().includes(q) || (a.nombre || '').toLowerCase().includes(q)))
    .sort(porArete);
  if (!lista.length) return <p class="mut">{!Object.keys(db.animales).length ? 'Aún no hay animales. Toque “➕ Agregar un animal”.'
    : q || filtro.finca ? 'No se encontró ningún animal. Revise el número o elija “Todas las fincas”.'
    : 'No hay animales activos. Los vendidos o muertos se ven con el botón de arriba.'}</p>;
  est.pagina = Math.min(est.pagina, Math.ceil(lista.length / POR_PAGINA) - 1);
  const pagina = lista.slice(est.pagina * POR_PAGINA, (est.pagina + 1) * POR_PAGINA);
  return <>{pagina.map(a => {
    const r = retiro(a), p = prenezAbierta(a);
    return (
      <div class="card item" onClick={() => abrir(a.arete)}>
        <span><b>{a.arete}</b> {a.nombre}<br />
          <span class="mut">{[a.finca, a.categoria, a.raza, a.tipo === 'leche' ? 'Leche' : 'Carne'].filter(Boolean).join(' · ')} · {cuantos(a.eventos.length, 'evento', 'eventos')}</span>
        </span>
        <span>{r ? <span class="tag bad">{r.motivo}</span> : p ? <span class="tag">Preñada · parto {fmt(p.parto)}</span> : null}</span>
      </div>
    );
  })}<Paginas total={lista.length} cambiar={cambiar} /></>;
}

export function Lista() {
  const { db, filtro } = est, hay = Object.keys(db.animales).length > 0;
  let cont!: HTMLElement;
  const pintar = () => cont.replaceChildren(<Tarjetas cambiar={pintar} />);
  const filtrar = () => { est.pagina = 0; pintar() }; // al buscar o cambiar de finca, volver a la primera página
  return (
    <section>
      {!hay && <div class="card">
        <h2>👋 Hola</h2>
        <p>Para empezar, toque <b>“➕ Agregar un animal”</b>.</p>
        <p>Si ya tiene una copia de sus datos, toque <b>“📂 Recuperar una copia”</b>, al final de esta pantalla.</p>
      </div>}
      <button class="pri grande" onClick={() => ir('escaner')}>📷 Escanear código QR</button>
      <button class="pri grande" onClick={() => abrir(null)}>➕ Agregar un animal</button>
      {hay && <button class="grande" onClick={() => ir('cambios')}>📲 Pasar lo anotado a otro teléfono (QR)</button>}
      <button class="grande" onClick={() => ir('reportes')}>📋 Reportes (enviar o imprimir)</button>
      <AvisoRespaldo />
      <Alertas />
      <h2>Mis animales</h2>
      <label for="buscar">Buscar por arete o nombre</label>
      <input id="buscar" type="search" placeholder="Ej.: 0441 o Lucera" value={filtro.q}
        onInput={(e: Event) => { filtro.q = (e.target as HTMLInputElement).value; filtrar() }} />
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
