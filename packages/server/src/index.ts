// Entry point for the WebSocket server.
//
// Placeholder for now — the Week 1 relay server (accept connections, group by
// room, broadcast put/delete/cursor, send init to late joiners) goes here next,
// once the wire protocol in @whiteboard/shared is signed off.

import type { ServerMessage } from "@whiteboard/shared";

const PORT = Number(process.env.PORT ?? 8080);

// Touch the import so the type wiring is exercised even before the real server
// exists; will be replaced by the actual relay implementation.
const _typecheckProbe: ServerMessage["t"] = "init";
void _typecheckProbe;

console.log(`[server] scaffolded; will listen on :${PORT} once implemented`);
