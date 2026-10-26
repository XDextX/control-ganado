// TSX sin librería: cada etiqueta crea el elemento real del DOM. El texto siempre entra como texto (sin riesgo de HTML inyectado).
type Hijo = Node | string | number | boolean | null | undefined | Hijo[];
type Props = Record<string, any> | null;

export function h(tag: string | ((p: any) => Node), props: Props, ...hijos: Hijo[]): Node {
  if (typeof tag === 'function') return tag({ ...props, children: hijos });
  const el = document.createElement(tag);
  agregar(el, hijos); // hijos antes que props: un <select value> necesita sus <option> ya puestas
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'ref') v(el);
    else if (k === 'class') el.className = v;
    else if (k === 'value' || k === 'checked') (el as any)[k] = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  return el;
}

export function Fragment({ children }: { children?: Hijo[] }): Node {
  const f = document.createDocumentFragment();
  agregar(f, children ?? []);
  return f;
}

function agregar(padre: Node, hijos: Hijo[]) {
  for (const c of (hijos as unknown[]).flat(Infinity) as Hijo[])
    if (c != null && typeof c !== 'boolean') padre.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
}

declare global {
  namespace JSX {
    type Element = Node;
    interface IntrinsicElements { [tag: string]: Record<string, any> }
  }
}
