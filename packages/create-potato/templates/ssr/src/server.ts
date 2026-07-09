/**
 * Minimal SSR + Live scaffold (Node http + ws).
 * Mirrors the working monorepo SSR example pattern.
 */
import { createServer, logger, cors } from "@potato/ssr"
import { createLiveHub } from "@potato/live"
import { createServer as createHttpServer } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer } from "ws"
import { createAppRaw } from "./app.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const cssPath = join(root, "dist/styles.css")
const tw = existsSync(cssPath)
  ? readFileSync(cssPath, "utf8")
  : "/* run: pnpm css */"

/** Inline Live client (queue until WS open) */
const liveBoot = `<script type="module">
const TOPIC = "page";
const encode = (m) => JSON.stringify(m);
const decode = (s) => JSON.parse(s);
const queue = [];
const root = document.getElementById("app");
let ws;
function morphChildren(from, to) {
  const toNodes = [...to.childNodes];
  while (from.childNodes.length > toNodes.length) from.removeChild(from.lastChild);
  for (let i = 0; i < toNodes.length; i++) {
    const tn = toNodes[i], fn = from.childNodes[i];
    if (tn.nodeType === 3) {
      if (fn && fn.nodeType === 3) { if (fn.nodeValue !== tn.nodeValue) fn.nodeValue = tn.nodeValue; }
      else from.insertBefore(document.createTextNode(tn.nodeValue || ""), fn || null);
      continue;
    }
    if (tn.nodeType !== 1) continue;
    if (fn && fn.nodeType === 1 && fn.nodeName === tn.nodeName) {
      for (const n of fn.getAttributeNames()) if (!tn.hasAttribute(n)) fn.removeAttribute(n);
      for (const a of tn.attributes) if (fn.getAttribute(a.name) !== a.value) fn.setAttribute(a.name, a.value);
      morphChildren(fn, tn);
    } else {
      const clone = tn.cloneNode(true);
      if (fn) from.replaceChild(clone, fn); else from.appendChild(clone);
    }
  }
}
function send(m) {
  if (ws && ws.readyState === 1) ws.send(encode(m));
  else queue.push(m);
}
root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-potato-click]");
  if (!el) return;
  e.preventDefault();
  let payload; const raw = el.getAttribute("data-potato-value");
  if (raw) { try { payload = JSON.parse(raw); } catch { payload = raw; } }
  send({ type: "event", topic: TOPIC, event: el.getAttribute("data-potato-click"), payload });
});
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(proto + "://" + location.host + "/__potato/live");
  ws.onopen = () => {
    ws.send(encode({ type: "join", topic: TOPIC, href: location.pathname }));
    while (queue.length) ws.send(encode(queue.shift()));
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
</script>`

const app = createAppRaw()

const hub = createLiveHub({
  app,
  onEvent: (event, payload, session) => {
    Object.assign(app.state, session.state)
    app.emitter.emit(event, payload)
    Object.assign(session.state, app.state)
  },
})

const potatoServer = createServer({
  app,
  middleware: [logger(), cors({ origin: "*" })],
  document: {
    title: "Potato SSR",
    bodyAttrs: 'class="min-h-screen bg-slate-950 antialiased"',
    styles: [`<style>${tw}</style>`],
    scripts: [liveBoot],
    livePath: "/__potato/live",
  },
})

potatoServer.get("/api/health", () => ({ ok: true, app: "potato-ssr" }))

const port = Number(process.env.PORT ?? 3000)
const httpServer = createHttpServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${port}`
    const url = `http://${host}${req.url ?? "/"}`
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
      else headers.set(k, v)
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : Buffer.concat(chunks)
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body?.length ? new Uint8Array(body) : undefined,
    })
    const response = await potatoServer.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    console.error(e)
    res.statusCode = 500
    res.end("error")
  }
})

const wss = new WebSocketServer({ noServer: true })
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/__potato/live")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const liveSocket = {
        send: (data: string) => {
          if (ws.readyState === ws.OPEN) ws.send(data)
        },
        close: () => ws.close(),
      }
      ws.on("message", (data) => {
        void hub.handleMessage(liveSocket, String(data))
      })
      ws.on("close", () => hub.disconnect(liveSocket))
    })
  } else socket.destroy()
})

httpServer.listen(port, () => {
  console.log(`Potato SSR + Live → http://localhost:${port}/`)
})
