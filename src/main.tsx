import { h, Fragment } from './jsx';
import './estilos.css';
import {
  Animal, CAMPOS, CATEGORIAS, EVENTOS, MOTIVOS, TipoEvento, alertas, cargar, diasHasta, fincas, fmt, fusionar, guardar,
  hoy, marcarRespaldo, nuevoId, ordenados, porArete, prenezAbierta, retiro, ultimoRespaldo,
} from './datos';
import { Reporte, TipoReporte, ficha, inventario, partos, reporteAImagen, salidas } from './reportes';
import { Escaner, ImagenQr, detenerCamara, interpretar, qrDeAnimal } from './qr';

type Vista = 'lista' | 'reportes' | 'reporte' | 'animal' | 'qr' | 'escaner';
let db = cargar();
let vista: Vista = 'lista', anterior: Vista = 'lista';
let actual: Animal | null = null;
const filtro = { q: '', finca: '', verRet: false };
let repTipo: TipoReporte = 'inventario', mes = hoy().slice(0, 7);
let qrModo: 'animal' | 'corral' = 'animal', areteNuevo = '';

const raiz = document.getElementById('app')!;
const VISTAS = { lista: Lista, reportes: MenuReportes, reporte: VerReporte, animal: Ficha, qr: VerQr, escaner: VerEscaner };
function render() { raiz.replaceChildren(<Encabezado />, <main>{VISTAS[vista]()}</main>) }
function ir(v: Vista) { detenerCamara(); if (v !== vista) anterior = vista; vista = v; render(); scrollTo(0, 0) }
function abrir(arete: string | null) { actual = arete ? db.animales[arete] : null; ir('animal') }
function volver() { actual = null; ir('lista') }

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: nombre }).dispatchEvent(new MouseEvent('click'));
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Mensaje grande que confirma que algo quedó guardado.
function avisar(texto: string) {
  const el = <div class="aviso-ok" role="status">{texto}</div> as HTMLElement;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ---------- Encabezado y letra grande ----------
const LETRA = 'ganado.v1.letra';
function letraGrande(): boolean { try { return localStorage.getItem(LETRA) === '1' } catch { return false } }
function cambiarLetra() {
  const nueva = !letraGrande();
  try { localStorage.setItem(LETRA, nueva ? '1' : '0') } catch { /* sin almacenamiento */ }
  document.documentElement.classList.toggle('letra-grande', nueva); render();
}
document.documentElement.classList.toggle('letra-grande', letraGrande());

function Encabezado() {
  return (
    <header>
      <h1>🐄 Registro de Ganado</h1>
      <button onClick={cambiarLetra}>{letraGrande() ? '🔍 Letra normal' : '🔍 Letra más grande'}</button>
    </header>
  );
}

// ---------- Copia de seguridad ----------
function guardarCopia() {
  descargar(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), `ganado-respaldo-${hoy()}.json`);
  marcarRespaldo(); render();
  avisar('✅ Copia guardada en Descargas');
}

function CopiaSeguridad() {
  const recuperar = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = '';
    if (!file) return;
    try {
      const n = fusionar(db, JSON.parse(await file.text()));
      guardar(db); volver(); alert(`Copia recuperada.\n\nSe agregaron ${n.animales} animales nuevos y ${n.eventos} eventos nuevos. No se borró nada.`);
    } catch (err) { alert('Ese archivo no es una copia de esta app.\n\n' + (err as Error).message) }
  };
  let archivo!: HTMLInputElement;
  return (
    <details>
      <summary>⚙️ Copia de seguridad</summary>
      <p class="ayuda">Guarde una copia seguido para no perder sus datos si se daña o cambia de teléfono. También sirve para pasar todos los animales a otro teléfono por WhatsApp.</p>
      <button class="grande" onClick={guardarCopia}>💾 Guardar una copia</button>
      <button class="grande" onClick={() => archivo.click()}>📂 Recuperar una copia</button>
      <input ref={(el: HTMLInputElement) => (archivo = el)} type="file" accept=".json,application/json" class="hide" onChange={recuperar} />
    </details>
  );
}

// ---------- Lista ----------
function AvisoRespaldo() {
  if (!Object.keys(db.animales).length) return null;
  const ult = ultimoRespaldo(), d = ult ? -diasHasta(ult) : null;
  if (d !== null && d < 7) return null;
  return (
    <div class="card warn">
      💾 {d === null ? 'Todavía no ha guardado una copia de sus datos.' : `Su última copia es de hace ${d} días.`}
      <button class="grande" onClick={guardarCopia}>💾 Guardar una copia ahora</button>
    </div>
  );
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
  if (!lista.length) return <p class="mut">{Object.keys(db.animales).length ? 'No se encontró ningún animal.' : 'Aún no hay animales. Toque “➕ Agregar un animal”.'}</p>;
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
      <button class="pri grande" onClick={() => ir('escaner')}>📷 Escanear código QR</button>
      <button class="pri grande" onClick={() => abrir(null)}>➕ Agregar un animal</button>
      <button class="grande" onClick={() => ir('reportes')}>📋 Reportes (enviar o imprimir)</button>
      <AvisoRespaldo />
      <Alertas />
      <h2>Mis animales</h2>
      <label for="buscar">Buscar por arete o nombre</label>
      <input id="buscar" type="search" placeholder="Ej.: 0441 o Lucera" value={filtro.q}
        onInput={(e: Event) => { filtro.q = (e.target as HTMLInputElement).value; pintar() }} />
      <label for="finca">Finca</label>
      <select id="finca" value={filtro.finca} onChange={(e: Event) => { filtro.finca = (e.target as HTMLSelectElement).value; pintar() }}>
        <option value="">Todas las fincas</option>
        {fincas(db).map(f => <option>{f}</option>)}
      </select>
      <button class="grande" onClick={() => { filtro.verRet = !filtro.verRet; render() }}>
        {filtro.verRet ? '🙈 Ocultar animales vendidos o muertos' : '👁️ Ver también animales vendidos o muertos'}
      </button>
      <div ref={(el: HTMLElement) => (cont = el)}><Tarjetas /></div>
      <CopiaSeguridad />
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
    db.animales[arete] = nuevo; guardar(db); abrir(arete); avisar('✅ Animal guardado');
  };
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      {a && <button class="grande" onClick={() => mostrarReporte('ficha')}>📋 Reporte de este animal</button>}
      {a && <button class="grande" onClick={() => { qrModo = 'animal'; ir('qr') }}>📲 Pasar este animal a otro teléfono (QR)</button>}
      {a && <button class="grande" onClick={() => { qrModo = 'corral'; ir('qr') }}>🏷️ Código QR para el arete o corral</button>}
      <form class="card" onSubmit={guardarAnimal}>
        <h2>{a ? 'Datos del animal ' + a.arete : 'Agregar un animal'}</h2>
        <label for="f-arete">Número de arete (obligatorio)</label>
        <input id="f-arete" name="arete" required inputmode="numeric" value={a?.arete ?? areteNuevo} />
        <label for="f-nombre">Nombre (si tiene)</label>
        <input id="f-nombre" name="nombre" value={a?.nombre ?? ''} />
        <label for="f-finca">Finca</label>
        <input id="f-finca" name="finca" list="listaFincas" value={a?.finca ?? ''} />
        <datalist id="listaFincas">{fincas(db).map(f => <option value={f} />)}</datalist>
        <details>
          <summary>Más datos (opcional)</summary>
          <label for="f-tipo">Tipo</label>
          <select id="f-tipo" name="tipo" value={a?.tipo ?? 'leche'}><option value="leche">Leche</option><option value="carne">Carne</option></select>
          <label for="f-nac">Fecha de nacimiento</label>
          <input id="f-nac" name="nac" type="date" value={a?.nac ?? ''} />
          <p class="ayuda">Toque el cuadro para elegir la fecha.</p>
          <label for="f-sexo">Sexo</label>
          <select id="f-sexo" name="sexo" value={a?.sexo || 'H'}><option value="H">Hembra</option><option value="M">Macho</option></select>
          <label for="f-raza">Raza</label>
          <input id="f-raza" name="raza" value={a?.raza ?? ''} />
          <label for="f-cat">Categoría</label>
          <select id="f-cat" name="categoria" value={a?.categoria ?? ''}><option value="">—</option>{CATEGORIAS.map(c => <option>{c}</option>)}</select>
          <label for="f-notas">Notas</label>
          <textarea id="f-notas" name="notas" rows="2" value={a?.notas ?? ''}></textarea>
        </details>
        <button class="pri grande">💾 Guardar animal</button>
      </form>
      {a && <NuevoEvento a={a} />}
      {a && <Historial a={a} />}
    </section>
  );
}

// Los más comunes como botones grandes; el resto en "Otro".
const COMUNES: [TipoEvento, string][] = [['monta', '🐂 Monta'], ['parto', '🍼 Parto'], ['secado', '🥛 Secado'], ['celo', '🔥 Celo']];

function NuevoEvento({ a }: { a: Animal }) {
  let tipo!: HTMLInputElement, otroBox!: HTMLElement, motivoBox!: HTMLElement, botones!: HTMLElement;
  const elegir = (t: string, boton?: HTMLElement) => {
    tipo.value = t;
    for (const b of botones.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === boton));
    motivoBox.classList.toggle('hide', t !== 'retiro');
  };
  const enviar = (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    if (!tipo.value) return alert('Primero toque qué pasó: Monta, Parto, Secado, Celo u Otro.');
    const ev = { id: nuevoId(), tipo: tipo.value as TipoEvento, fecha: val('fecha'), nota: val('nota'), motivo: undefined as string | undefined };
    if (ev.tipo === 'retiro') {
      if (retiro(a)) return alert('Este animal ya está retirado.');
      ev.motivo = val('motivo');
      if (!confirm(`¿Seguro que quiere retirar al animal ${a.arete} por ${ev.motivo}?\n\nYa no aparecerá en la lista.`)) return;
    } else delete ev.motivo;
    a.eventos.push(ev); guardar(db); render(); avisar('✅ Guardado: ' + EVENTOS[ev.tipo]);
  };
  return (
    <form class="card" onSubmit={enviar}>
      <h2>¿Qué pasó con este animal?</h2>
      <input type="hidden" ref={(el: HTMLInputElement) => (tipo = el)} />
      <div class="eventos" ref={(el: HTMLElement) => (botones = el)}>
        {COMUNES.map(([t, texto]) => <button type="button" aria-pressed="false"
          onClick={(e: Event) => { otroBox.classList.add('hide'); elegir(t, e.currentTarget as HTMLElement) }}>{texto}</button>)}
        <button type="button" aria-pressed="false" style="grid-column:1/-1"
          onClick={(e: Event) => { otroBox.classList.remove('hide'); elegir('', e.currentTarget as HTMLElement) }}>➕ Otro (preñez, destete, venta, muerte…)</button>
      </div>
      <div class="hide" ref={(el: HTMLElement) => (otroBox = el)}>
        <label for="f-otro">¿Cuál?</label>
        <select id="f-otro" onChange={(e: Event) => { tipo.value = (e.target as HTMLSelectElement).value; motivoBox.classList.toggle('hide', tipo.value !== 'retiro') }}>
          <option value="">— Elija —</option>
          {Object.entries(EVENTOS).filter(([k]) => !COMUNES.some(([c]) => c === k)).map(([k, v]) => <option value={k}>{v}</option>)}
        </select>
      </div>
      <div class="hide" ref={(el: HTMLElement) => (motivoBox = el)}>
        <label for="f-motivo">¿Por qué salió?</label>
        <select id="f-motivo" name="motivo">{MOTIVOS.map(m => <option>{m}</option>)}</select>
      </div>
      <label for="f-fecha">Fecha</label>
      <input id="f-fecha" name="fecha" type="date" required value={hoy()} />
      <p class="ayuda">Ya tiene la fecha de hoy. Toque el cuadro si fue otro día.</p>
      <label for="f-nota">Nota (si quiere)</label>
      <input id="f-nota" name="nota" placeholder="Ej.: toro Pinto, cría macho" />
      <button class="pri grande">💾 Guardar lo que pasó</button>
    </form>
  );
}

function Historial({ a }: { a: Animal }) {
  const c = (t: TipoEvento) => a.eventos.filter(e => e.tipo === t).length;
  const p = prenezAbierta(a), r = retiro(a);
  const borrar = (id: string) => {
    if (!confirm('¿Seguro que quiere borrar este evento?\n\nNo se puede deshacer.')) return;
    a.eventos = a.eventos.filter(x => x.id !== id); guardar(db); render(); avisar('✅ Borrado');
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
            <button class="borrar" onClick={() => borrar(e.id)}>Borrar</button>
          </li>
        )) : <li class="mut">Sin eventos todavía.</li>}
      </ul>
    </div>
  );
}

// ---------- Códigos QR ----------
function VerQr() {
  const a = actual!, corral = qrModo === 'corral';
  return (
    <section>
      <div class="noprint"><button onClick={() => ir('animal')}>← Volver</button></div>
      <div class="card" style="text-align:center">
        <h2>{corral ? 'Arete' : 'Pasar animal'} {a.arete}{a.nombre ? ' · ' + a.nombre : ''}</h2>
        <ImagenQr texto={corral ? a.arete : qrDeAnimal(a)} />
        <p class="noprint">{corral
          ? 'Imprima este código y péguelo en el corral o junto al arete. Al escanearlo con la app se abre la ficha del animal.'
          : 'En el otro teléfono abra la app, toque “📷 Escanear código QR” y apunte a esta pantalla. Se suman los datos sin borrar nada.'}</p>
      </div>
      {corral && <button class="grande noprint" onClick={() => print()}>🖨️ Imprimir código</button>}
    </section>
  );
}

function leerQr(texto: string) {
  let l;
  try { l = interpretar(texto) } catch { alert('El código QR no se pudo leer. Intente de nuevo.'); return ir('escaner') }
  if (l.tipo === 'animal') {
    try {
      const n = fusionar(db, l.datos); guardar(db);
      alert(`Listo. Se agregaron ${n.animales} animales nuevos y ${n.eventos} eventos nuevos.`);
      return abrir(Object.keys((l.datos as { animales: object }).animales)[0]);
    } catch (e) { alert('Este código no es de la app de ganado. ' + (e as Error).message); return ir('lista') }
  }
  if (db.animales[l.arete]) return abrir(l.arete);
  if (confirm(`El arete ${l.arete} no está registrado.\n\n¿Quiere darlo de alta ahora?`)) { areteNuevo = l.arete; abrir(null); areteNuevo = '' }
  else ir('lista');
}

function VerEscaner() {
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <h2>Escanear código QR</h2>
      <Escaner alLeer={leerQr} />
    </section>
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
