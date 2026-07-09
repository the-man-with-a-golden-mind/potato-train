/**
 * Inline Live client boot script (no bundler).
 * Queues events until WebSocket is open, then morphs #app patches.
 */
export function liveBootScript(opts?: {
  topic?: string
  path?: string
}): string {
  const topic = opts?.topic ?? "page"
  const path = opts?.path ?? "/__potato/live"
  return `<script type="module">
const TOPIC = ${JSON.stringify(topic)};
const PATH = ${JSON.stringify(path)};
const encode = (m) => JSON.stringify(m);
const decode = (s) => JSON.parse(s);
const queue = [];

function morphChildren(from, to) {
  const toNodes = [...to.childNodes];
  while (from.childNodes.length > toNodes.length) from.removeChild(from.lastChild);
  for (let i = 0; i < toNodes.length; i++) {
    const tn = toNodes[i];
    const fn = from.childNodes[i];
    if (tn.nodeType === 3) {
      if (fn && fn.nodeType === 3) {
        if (fn.nodeValue !== tn.nodeValue) fn.nodeValue = tn.nodeValue;
      } else {
        from.insertBefore(document.createTextNode(tn.nodeValue || ""), fn || null);
      }
      continue;
    }
    if (tn.nodeType !== 1) continue;
    if (fn && fn.nodeType === 1 && fn.nodeName === tn.nodeName) {
      for (const n of fn.getAttributeNames()) if (!tn.hasAttribute(n)) fn.removeAttribute(n);
      for (const a of tn.attributes) if (fn.getAttribute(a.name) !== a.value) fn.setAttribute(a.name, a.value);
      morphChildren(fn, tn);
    } else {
      const clone = tn.cloneNode(true);
      if (fn) from.replaceChild(clone, fn);
      else from.appendChild(clone);
    }
  }
}

const root = document.getElementById("app");
let ws;

function send(m) {
  if (ws && ws.readyState === 1) ws.send(encode(m));
  else queue.push(m);
}
function flush() {
  while (queue.length && ws && ws.readyState === 1) {
    ws.send(encode(queue.shift()));
  }
}

root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-potato-click]");
  if (!el) return;
  e.preventDefault();
  let payload;
  const raw = el.getAttribute("data-potato-value");
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = raw; }
  }
  send({ type: "event", topic: TOPIC, event: el.getAttribute("data-potato-click"), payload });
});
root.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-potato-submit]");
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  send({ type: "event", topic: TOPIC, event: form.getAttribute("data-potato-submit"), payload });
  form.reset();
});

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(proto + "://" + location.host + PATH);
  ws.onopen = () => {
    ws.send(encode({ type: "join", topic: TOPIC, href: location.pathname + location.search }));
    flush();
  };
  ws.onmessage = (ev) => {
    const msg = decode(ev.data);
    if (msg.type === "ok" || msg.type === "patch") {
      const t = document.createElement("template");
      t.innerHTML = msg.html.trim();
      morphChildren(root, t.content);
    }
  };
  ws.onclose = () => setTimeout(connect, 1200);
}
connect();
setInterval(() => { if (ws && ws.readyState === 1) send({ type: "ping" }); }, 25000);
console.info("[potato/live] boot ready", TOPIC);
</script>`
}
