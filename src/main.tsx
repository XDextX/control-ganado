import { h, Fragment } from './jsx';
import './estilos.css';
import {
  Animal, CAMPOS, CATEGORIAS, EVENTOS, MOTIVOS, TipoEvento, alertas, cargar, diasHasta, fincas, fmt, fusionar, guardar,
  hoy, marcarRespaldo, nuevoId, ordenados, porArete, prenezAbierta, retiro, ultimoRespaldo,
} from './datos';
import { Reporte, TipoReporte, ficha, inventario, partos, reporteAImagen, salidas } from './reportes';

type Vista = 'lista' | 'reportes' | 'reporte' | 'animal';
let db = cargar();
let vista: Vista = 'lista', anterior: Vista = 'lista';
let actual: Animal | null = null;
const filtro = { q: '', finca: '', verRet: false };
let repTipo: TipoReporte = 'inventario', mes = hoy().slice(0, 7);

const raiz = document.getElementById('app')!;
function render() { raiz.replaceChildren(<Encabezado />, <main>{{ lista: Lista, reportes: MenuReportes, reporte: VerReporte, animal: Ficha }[vista]()}</main>) }
function ir(v: Vista) { if (v !== vista) anterior = vista; vista = v; render(); scrollTo(0, 0) }
function abrir(arete: string | null) { actual = arete ? db.animales[arete] : null; ir('animal') }
function volver() { actual = null; ir('lista') }

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: nombre }).dispatchEvent(new MouseEvent('click'));
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Encabezado: respaldo ----------
function Encabezado() {
  const exportar = () => {
    descargar(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), `ganado-respaldo-${hoy()}.json`);
    marcarRespaldo(); render();
  };
  const importar = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = '';
    if (!file) return;
    try {
      const n = fusionar(db, JSON.parse(await file.text()));
      guardar(db); volver(); alert(`Respaldo importado: ${n.animales} animales nuevos, ${n.eventos} eventos nuevos.`);
    } catch (err) { alert('Archivo no válido: ' + (err as Error).message) }
  };
  let archivo!: HTMLInputElement;
  return (
    <header>
      <h1>🐄 Registro de Ganado</h1>
      <button onClick={exportar}>Exportar respaldo</button>
      <button onClick={() => archivo.click()}>Importar respaldo</button>
      <input ref={(el: HTMLInputElement) => (archivo = el)} type="file" accept=".json,application/json" class="hide" onChange={importar} />
    </header>
  );
}

// ---------- Lista ----------
function AvisoRespaldo() {
  if (!Object.keys(db.animales).length) return null;
  const ult = ultimoRespaldo(), d = ult ? -diasHasta(ult) : null;
  if (d !== null && d < 7) return null;
  return <div class="card warn">💾 {d === null ? 'Aún no ha exportado ningún respaldo.' : `Último respaldo: hace ${d} días.`} Pulse “Exportar respaldo” para no perder datos.</div>;
}

function Alertas() {
  const al = alertas(db);
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

function Tarjetas() {
  const q = filtro.q.trim().toLowerCase();
  const lista = Object.values(db.animales)
    .filter(a => (filtro.verRet || !retiro(a)) && (!filtro.finca || a.finca === filtro.finca) &&
      (!q || a.arete.toLowerCase().includes(q) || (a.nombre || '').toLowerCase().includes(q)))
    .sort(porArete);
  if (!lista.length) return <p class="mut">{Object.keys(db.animales).length ? 'Sin resultados.' : 'Aún no hay animales. Pulse “+ Nuevo animal”.'}</p>;
  return <>{lista.map(a => {
    const r = retiro(a), p = prenezAbierta(a);
    return (
      <div class="card item" onClick={() => abrir(a.arete)}>
        <span><b>{a.arete}</b> {a.nombre}<br />
          <span class="mut">{[a.finca, a.categoria, a.raza, a.tipo === 'leche' ? 'Leche' : 'Carne'].filter(Boolean).join(' · ')} · {a.eventos.length} eventos</span>
        </span>
        <span>{r ? <span class="tag bad">{r.motivo}</span> : p ? <span class="tag">Preñada · parto {fmt(p.parto)}</span> : null}</span>
      </div>
    );
  })}</>;
}

function Lista() {
  let cont!: HTMLElement;
  const pintar = () => cont.replaceChildren(<Tarjetas />);
  return (
    <section>
      <button class="pri grande" onClick={() => ir('reportes')}>📋 Reportes (enviar o imprimir)</button>
      <AvisoRespaldo />
      <Alertas />
      <div class="row" style="margin-top:10px">
        <input type="search" placeholder="Buscar por arete o nombre" aria-label="Buscar" value={filtro.q}
          onInput={(e: Event) => { filtro.q = (e.target as HTMLInputElement).value; pintar() }} />
        <select aria-label="Finca" value={filtro.finca} onChange={(e: Event) => { filtro.finca = (e.target as HTMLSelectElement).value; pintar() }}>
          <option value="">Todas las fincas</option>
          {fincas(db).map(f => <option>{f}</option>)}
        </select>
        <button class="pri" style="flex:0 0 auto" onClick={() => abrir(null)}>+ Nuevo animal</button>
      </div>
      <label><input type="checkbox" style="width:auto;min-height:0" checked={filtro.verRet}
        onChange={(e: Event) => { filtro.verRet = (e.target as HTMLInputElement).checked; pintar() }} /> Mostrar retirados</label>
      <div ref={(el: HTMLElement) => (cont = el)}><Tarjetas /></div>
    </section>
  );
}

// ---------- Ficha del animal ----------
function Ficha() {
  const a = actual;
  const guardarAnimal = (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    const arete = val('arete');
    if (!arete) return;
    if (arete !== a?.arete && db.animales[arete]) return alert('Ya existe un animal con el arete ' + arete);
    const nuevo = a ?? ({ eventos: [] } as unknown as Animal);
    if (a && arete !== a.arete) delete db.animales[a.arete];
    for (const k of CAMPOS) (nuevo as any)[k] = val(k);
    db.animales[arete] = nuevo; guardar(db); abrir(arete);
  };
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      {a && <button class="grande" onClick={() => mostrarReporte('ficha')}>📋 Reporte de este animal</button>}
      <form class="card" onSubmit={guardarAnimal}>
        <h2>{a ? 'Animal ' + a.arete : 'Nuevo animal'}</h2>
        <div class="row">
          <div><label>Arete *</label><input name="arete" required value={a?.arete ?? ''} /></div>
          <div><label>Nombre</label><input name="nombre" value={a?.nombre ?? ''} /></div>
        </div>
        <div class="row">
          <div><label>Tipo</label><select name="tipo" value={a?.tipo ?? 'leche'}><option value="leche">Leche</option><option value="carne">Carne</option></select></div>
          <div><label>Fecha de nacimiento</label><input name="nac" type="date" value={a?.nac ?? ''} /></div>
        </div>
        <div class="row">
          <div><label>Finca / zona</label><input name="finca" list="listaFincas" value={a?.finca ?? ''} />
            <datalist id="listaFincas">{fincas(db).map(f => <option value={f} />)}</datalist></div>
          <div><label>Sexo</label><select name="sexo" value={a?.sexo || 'H'}><option value="H">Hembra</option><option value="M">Macho</option></select></div>
        </div>
        <div class="row">
          <div><label>Raza</label><input name="raza" value={a?.raza ?? ''} /></div>
          <div><label>Categoría</label><select name="categoria" value={a?.categoria ?? ''}><option value="">—</option>{CATEGORIAS.map(c => <option>{c}</option>)}</select></div>
        </div>
        <label>Notas</label><textarea name="notas" rows="2" value={a?.notas ?? ''}></textarea>
        <p><button class="pri">Guardar animal</button></p>
      </form>
      {a && <NuevoEvento a={a} />}
      {a && <Historial a={a} />}
    </section>
  );
}

function NuevoEvento({ a }: { a: Animal }) {
  let motivoBox!: HTMLElement;
  const enviar = (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    const ev = { id: nuevoId(), tipo: val('tipo') as TipoEvento, fecha: val('fecha'), nota: val('nota'), motivo: undefined as string | undefined };
    if (ev.tipo === 'retiro') {
      if (retiro(a)) return alert('Este animal ya está retirado.');
      ev.motivo = val('motivo');
      if (!confirm(`¿Seguro que quiere retirar al animal ${a.arete} por ${ev.motivo}?\n\nYa no aparecerá en la lista.`)) return;
    } else delete ev.motivo;
    a.eventos.push(ev); guardar(db); render();
  };
  return (
    <form class="card" onSubmit={enviar}>
      <h2>Añadir evento</h2>
      <div class="row">
        <div><label>Evento</label>
          <select name="tipo" onChange={(e: Event) => motivoBox.classList.toggle('hide', (e.target as HTMLSelectElement).value !== 'retiro')}>
            {Object.entries(EVENTOS).map(([k, v]) => <option value={k}>{v}</option>)}
          </select></div>
        <div><label>Fecha</label><input name="fecha" type="date" required value={hoy()} /></div>
      </div>
      <div class="hide" ref={(el: HTMLElement) => (motivoBox = el)}><label>Motivo del retiro</label>
        <select name="motivo">{MOTIVOS.map(m => <option>{m}</option>)}</select></div>
      <label>Nota</label><input name="nota" placeholder="Toro, semen, cría, comprador…" />
      <p><button class="pri">Añadir evento</button></p>
    </form>
  );
}

function Historial({ a }: { a: Animal }) {
  const c = (t: TipoEvento) => a.eventos.filter(e => e.tipo === t).length;
  const p = prenezAbierta(a), r = retiro(a);
  const borrar = (id: string) => {
    if (!confirm('¿Seguro que quiere borrar este evento?\n\nNo se puede deshacer.')) return;
    a.eventos = a.eventos.filter(x => x.id !== id); guardar(db); render();
  };
  return (
    <div class="card"><h2>Historial</h2>
      <div class="mut">
        Preñeces: {c('prenez')} · Partos: {c('parto')} · Celos: {c('celo')} · Destetes: {c('destete')} · Secados: {c('secado')}
        {p && <><br /><b class="warn">Parto probable: {fmt(p.parto)}{p.secado ? ' · Secar el ' + fmt(p.secado) : ''}</b></>}
        {r && <><br /><b class="bad">Retirado: {r.motivo} el {fmt(r.fecha)}</b></>}
      </div>
      <ul>
        {a.eventos.length ? ordenados(a).reverse().map(e => (
          <li class="ev">
            <span><b>{EVENTOS[e.tipo]}</b>{e.motivo ? ' · ' + e.motivo : ''}<br />
              <span class="mut">{fmt(e.fecha)}{e.nota ? ' · ' + e.nota : ''}</span></span>
            <button aria-label="Borrar evento" style="flex:0 0 auto" onClick={() => borrar(e.id)}>✕</button>
          </li>
        )) : <li class="mut">Sin eventos todavía.</li>}
      </ul>
    </div>
  );
}

// ---------- Reportes ----------
function MenuReportes() {
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>¿Qué reporte quiere?</h2>
      <button class="grande" onClick={() => mostrarReporte('inventario')}>🐄 Animales por finca</button>
      <button class="grande" onClick={() => mostrarReporte('partos')}>🍼 Próximos partos y secados</button>
      <button class="grande" onClick={() => mostrarReporte('salidas')}>📤 Salidas del mes (ventas, muertes, bajas)</button>
      <p class="mut">El reporte de un solo animal está dentro de la ficha de cada animal.</p>
    </section>
  );
}

function mostrarReporte(t: TipoReporte) { repTipo = t; ir('reporte') }
const armar = (): Reporte => repTipo === 'ficha' ? ficha(actual!) : repTipo === 'salidas' ? salidas(db, mes) : repTipo === 'partos' ? partos(db) : inventario(db);

function VerReporte() {
  const r = armar();
  const enviarFoto = () => reporteAImagen(r).toBlob(async blob => {
    const file = new File([blob!], `reporte-${repTipo}-${hoy()}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: r.titulo }) } catch { /* el usuario canceló */ }
    } else {
      descargar(blob!, file.name);
      alert('Se descargó la imagen del reporte. Puede enviarla por WhatsApp desde sus descargas.');
    }
  }, 'image/png');
  return (
    <section>
      <div class="noprint">
        <button onClick={() => ir(anterior)}>← Volver</button>
        {repTipo === 'salidas' && <div><label>Mes</label>
          <input type="month" value={mes} onChange={(e: Event) => { mes = (e.target as HTMLInputElement).value || hoy().slice(0, 7); render() }} /></div>}
        <button class="pri grande" onClick={enviarFoto}>📲 Enviar como foto (WhatsApp)</button>
        <button class="grande" onClick={() => print()}>🖨️ Guardar PDF / Imprimir</button>
      </div>
      <div id="reporte" class="card">
        <h2>{r.titulo}</h2><p class="mut">{r.sub}</p>
        {r.secciones.map(s => <>
          {s.titulo && <h3>{s.titulo}</h3>}
          {s.nota && <p>{s.nota}</p>}
          {s.filas.length > 0 && <table>
            {s.cols.length > 0 && <tr>{s.cols.map(c => <th>{c}</th>)}</tr>}
            {s.filas.map(f => <tr>{f.map((c, i) => <td>{!s.cols.length && i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}
          </table>}
        </>)}
      </div>
    </section>
  );
}

render();
// Sin señal en el campo. Solo en producción: en desarrollo el caché estorbaría los cambios.
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js');
