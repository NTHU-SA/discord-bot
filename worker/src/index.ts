import { WorkerClient } from "./client";
import { loadWorkerConfig } from "./config";

const config = await loadWorkerConfig();
const client = new WorkerClient(config);
const healthServer = Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.MINISAGO_WORKER_HEALTH_PORT || 8081),
  fetch(request) {
    if (
      request.method !== "GET" ||
      new URL(request.url).pathname !== "/health"
    ) {
      return new Response("Not found.", { status: 404 });
    }
    const health = client.health();
    return Response.json(health, { status: health.ok ? 200 : 503 });
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    healthServer.stop();
    client.stop();
    process.exit(0);
  });
}

client.start();
