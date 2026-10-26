import { h } from '../jsx';
import { Animal, CAMPOS, CATEGORIAS, EVENTOS, MOTIVOS, TipoEvento, fincas, fmt, guardar, hoy, nuevoId, ordenados, prenezAbierta, retiro } from '../datos';
import { abrir, avisar, est, ir, mostrarReporte, render, volver } from '../estado';
import { EliminarAnimal } from '../componentes/EliminarDatos';

function Formulario({ a }: { a: Animal | null }) {
  const guardarAnimal = (e: Event) => {
    e.preventDefault();
    const { db } = est, f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    const arete = val('arete');
    if (!arete) return;
    if (arete !== a?.arete && db.animales[arete]) return alert('Ya existe un animal con el arete ' + arete);
    const nuevo = a ?? ({ eventos: [] } as unknown as Animal);
    if (a && arete !== a.arete) delete db.animales[a.arete];
    for (const k of CAMPOS) (nuevo as any)[k] = val(k);
    nuevo.creado ??= hoy();
    db.animales[arete] = nuevo; guardar(db); abrir(arete); avisar('✅ Animal guardado');
  };
  return (
    <form class="card" onSubmit={guardarAnimal}>
      <h2>{a ? 'Cambiar datos del animal ' + a.arete : 'Agregar un animal'}</h2>
      <label for="f-arete">Número de arete (obligatorio)</label>
      <input id="f-arete" name="arete" required inputmode="numeric" value={a?.arete ?? est.areteNuevo} />
      <label for="f-nombre">Nombre (si tiene)</label>
      <input id="f-nombre" name="nombre" value={a?.nombre ?? ''} />
      <label for="f-finca">Finca</label>
      <input id="f-finca" name="finca" list="listaFincas" value={a?.finca ?? ''} />
      <datalist id="listaFincas">{fincas(est.db).map(f => <option value={f} />)}</datalist>
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
  );
}

// Los más comunes como botones grandes; el resto en "Otro".
const COMUNES: [TipoEvento, string][] = [['monta', '🐂 Monta'], ['parto', '🍼 Parto'], ['secado', '🥛 Secado'], ['celo', '🔥 Celo']];

// Lo menos frecuente, también con botones. Vender, morir o dar de baja son una "salida" (retiro) con su motivo.
const OTROS: [TipoEvento, string, string?][] = [
  ['prenez', '✔️ Preñez confirmada'], ['destete', '🐄 Destete'], ['aborto', '❌ Aborto / vacía'],
  ['retiro', '💰 Vendido', MOTIVOS[0]], ['retiro', '✝️ Murió', MOTIVOS[1]], ['retiro', '📤 Dado de baja', MOTIVOS[2]],
];

function NuevoEvento({ a }: { a: Animal }) {
  let tipo!: HTMLInputElement, motivo!: HTMLInputElement, otroBox!: HTMLElement, form!: HTMLElement;
  const elegir = (t: string, m: string, boton: HTMLElement) => {
    tipo.value = t; motivo.value = m;
    for (const b of form.querySelectorAll('.eventos button')) b.setAttribute('aria-pressed', String(b === boton));
  };
  const enviar = (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
    if (!tipo.value) return alert('Primero toque qué pasó: Monta, Parto, Secado, Celo u Otro.');
    const ev = { id: nuevoId(), tipo: tipo.value as TipoEvento, fecha: val('fecha'), nota: val('nota'), motivo: undefined as string | undefined };
    if (ev.tipo === 'retiro') {
      ev.motivo = motivo.value;
      if (!confirm(`¿Seguro? El animal ${a.arete} quedará como: ${ev.motivo}.\n\nYa no aparecerá en la lista de animales.`)) return;
    } else delete ev.motivo;
    a.eventos.push(ev); guardar(est.db); render(); avisar('✅ Guardado: ' + (ev.motivo ?? EVENTOS[ev.tipo]));
  };
  return (
    <form class="card" onSubmit={enviar} ref={(el: HTMLElement) => (form = el)}>
      <h2>¿Qué pasó con este animal?</h2>
      <input type="hidden" ref={(el: HTMLInputElement) => (tipo = el)} />
      <input type="hidden" ref={(el: HTMLInputElement) => (motivo = el)} />
      <div class="eventos">
        {COMUNES.map(([t, texto]) => <button type="button" aria-pressed="false"
          onClick={(e: Event) => { otroBox.classList.add('hide'); elegir(t, '', e.currentTarget as HTMLElement) }}>{texto}</button>)}
        <button type="button" aria-pressed="false" style="grid-column:1/-1"
          onClick={(e: Event) => { otroBox.classList.remove('hide'); elegir('', '', e.currentTarget as HTMLElement) }}>➕ Otro (preñez, destete, venta, muerte…)</button>
      </div>
      <div class="hide eventos" ref={(el: HTMLElement) => (otroBox = el)}>
        {OTROS.map(([t, texto, m]) => <button type="button" aria-pressed="false"
          onClick={(e: Event) => elegir(t, m ?? '', e.currentTarget as HTMLElement)}>{texto}</button>)}
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
  const borrar = (id: string) => {
    if (!confirm('¿Seguro que quiere borrar este evento?\n\nNo se puede deshacer.')) return;
    a.eventos = a.eventos.filter(x => x.id !== id); guardar(est.db); render(); avisar('✅ Borrado');
  };
  return (
    <div class="card"><h2>Historial</h2>
      <div class="mut">
        Preñeces: {c('prenez')} · Partos: {c('parto')} · Celos: {c('celo')} · Destetes: {c('destete')} · Secados: {c('secado')}
      </div>
      <ul>
        {a.eventos.length ? ordenados(a).reverse().map(e => (
          <li class="ev">
            <span><b>{e.tipo === 'retiro' ? 'Salida: ' + e.motivo : EVENTOS[e.tipo]}</b><br />
              <span class="mut">{fmt(e.fecha)}{e.nota ? ' · ' + e.nota : ''}</span></span>
            <button class="borrar" onClick={() => borrar(e.id)}>Borrar</button>
          </li>
        )) : <li class="mut">Sin eventos todavía.</li>}
      </ul>
    </div>
  );
}

export function Ficha() {
  const a = est.actual;
  if (!a) return <section><button onClick={volver}>← Volver</button><Formulario a={null} /></section>;
  // Animal existente: primero lo de todos los días; datos y QR guardados abajo para no cambiarlos sin querer.
  const p = prenezAbierta(a), r = retiro(a);
  return (
    <section>
      <button onClick={volver}>← Volver</button>
      <div class="card">
        <h2 class="titulo-animal">🐄 {a.arete}{a.nombre ? ' · ' + a.nombre : ''}</h2>
        <p class="mut">{[a.finca, a.categoria, a.raza, a.tipo === 'leche' ? 'Leche' : 'Carne'].filter(Boolean).join(' · ')}</p>
        {r ? <p class="bad"><b>Salió: {r.motivo} el {fmt(r.fecha)}</b></p>
          : p ? <p class="warn"><b>Preñada · parto probable {fmt(p.parto)}{p.secado ? ' · secar el ' + fmt(p.secado) : ''}</b></p> : null}
      </div>
      {!r && <NuevoEvento a={a} />}
      <Historial a={a} />
      <details>
        <summary>✏️ Cambiar datos del animal</summary>
        <Formulario a={a} />
      </details>
      <details>
        <summary>📲 Compartir o imprimir</summary>
        <button class="grande" onClick={() => mostrarReporte('ficha')}>📋 Reporte de este animal</button>
        <button class="grande" onClick={() => { est.qrModo = 'animal'; ir('qr') }}>📲 Pasar este animal a otro teléfono (QR)</button>
        <button class="grande" onClick={() => { est.qrModo = 'corral'; ir('qr') }}>🏷️ Código QR para el arete o corral</button>
      </details>
      <EliminarAnimal a={a} />
    </section>
  );
}
