/**
 * 极简 CDP 截图 / 状态工具（无需 playwright）
 *   node tools/qa.mjs --url <u> --out <png> [--w 1280] [--h 900] [--wait 1200]
 *                     [--init "js 在文档开始前注入"] [--eval "js 等待后执行"]
 *                     [--wait2 600] [--full]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf("--" + name);
  if (i === -1) return def;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
};

const url = flag("url");
const outPng = flag("out");
if (!url || !outPng) {
  console.error("need --url and --out");
  process.exit(2);
}
const width = Number(flag("w", 1280));
const height = Number(flag("h", 900));
const wait = Number(flag("wait", 1500));
const wait2 = Number(flag("wait2", 0));
const init = flag("init", null);
const evalExpr = flag("eval", null);
const full = Boolean(flag("full", false));
const clip = flag("clip", null);
const clipScale = Number(flag("scale", 2));
const mouse = flag("mouse", null);
const mouseSel = flag("mouse-sel", null);
const evalExpr2 = flag("eval2", null);
const wheel = flag("wheel", null);

const port = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "pbqa-"));

const child = spawn(
  EDGE,
  [
    "--headless=new",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 150; i += 1) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (r.ok) {
      wsUrl = (await r.json()).webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* not up yet */
  }
  await sleep(100);
}
if (!wsUrl) {
  console.error("edge devtools never came up");
  child.kill();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let nextId = 0;
const pending = new Map();
const logs = [];
let sessionId = null;

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message));
    else res(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    logs.push("EXC: " + (d.exception?.description || d.text));
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type !== "debug") {
    logs.push(
      msg.params.type + ": " + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ")
    );
  } else if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level !== "verbose") logs.push(e.level + "/" + e.source + ": " + e.text);
  }
});

function send(method, params = {}, useSession = true) {
  const id = ++nextId;
  const payload = { id, method, params };
  if (useSession && sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" }, false);
sessionId = (await send("Target.attachToTarget", { targetId, flatten: true }, false)).sessionId;

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 600,
});

if (init) {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: String(init) });
}

await send("Page.navigate", { url });
await sleep(wait);

let evaluated = null;
if (evalExpr) {
  evaluated = await send("Runtime.evaluate", {
    expression: `(() => { try { return JSON.stringify(${evalExpr}); } catch (e) { return "EVAL_ERR " + e.message; } })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (wait2) await sleep(wait2);
}

let mouseAt = mouse ? String(mouse).split(",").map(Number) : null;

if (!mouseAt && mouseSel) {
  const r = await send("Runtime.evaluate", {
    expression: `(()=>{const e=document.querySelector(${JSON.stringify(String(mouseSel))});if(!e)return "";e.scrollIntoView({block:"center",behavior:"instant"});const r=e.getBoundingClientRect();return JSON.stringify([r.left+r.width/2,r.top+r.height/2])})()`,
    returnByValue: true,
  });
  if (r.result?.value) mouseAt = JSON.parse(r.result.value);
  await sleep(400);
}

if (mouseAt) {
  const dx = Number(flag("mouse-dx", 0));
  const dy = Number(flag("mouse-dy", 0));
  const [mx, my] = [Number(mouseAt[0]) + dx, Number(mouseAt[1]) + dy];
  for (const type of ["mouseMoved", "mouseMoved"]) {
    await send("Input.dispatchMouseEvent", { type, x: mx, y: my, button: "none", buttons: 0 });
    await sleep(80);
  }
  await sleep(Number(flag("wait3", 700)));
}

if (wheel) {
  const total = Number(wheel);
  const steps = Math.min(12, Math.max(1, Math.round(total / 400)));
  for (let i = 0; i < steps; i += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      deltaX: 0,
      deltaY: total / steps,
    });
    await sleep(120);
  }
  await sleep(Number(flag("wait3", 1400)));
}

const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: full,
  ...(clip
    ? {
        clip: {
          x: Number(String(clip).split(",")[0]),
          y: Number(String(clip).split(",")[1]),
          width: Number(String(clip).split(",")[2]),
          height: Number(String(clip).split(",")[3]),
          scale: clipScale,
        },
      }
    : {}),
});
writeFileSync(outPng, Buffer.from(shot.data, "base64"));

if (evalExpr2) {
  const after = await send("Runtime.evaluate", {
    expression: `(() => { try { return JSON.stringify(${evalExpr2}); } catch (e) { return "EVAL_ERR " + e.message; } })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log("--- eval2 ---\n" + (after.result?.value ?? JSON.stringify(after)));
}

if (evaluated) console.log("--- eval ---\n" + (evaluated.result?.value ?? JSON.stringify(evaluated)));
console.log("--- logs (" + logs.length + ") ---");
console.log(logs.slice(0, 30).join("\n") || "(none)");

ws.close();
child.kill();
process.exit(0);
