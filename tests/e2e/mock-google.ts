import { createServer, type Server } from "node:http";
import { FakeGoogle } from "../support/fake-google";

/**
 * Serves the simulated Google endpoints over HTTP for browser tests, plus a small admin API
 * (`/__admin/...`) that tests use to add Google events, inspect what Yawm wrote, inject
 * failures, and revoke access.
 */
export const MOCK_GOOGLE_PORT = 4010;
export const MOCK_GOOGLE_ORIGIN = `http://127.0.0.1:${MOCK_GOOGLE_PORT}`;

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function startMockGoogle(): Promise<Server> {
  const fake = new FakeGoogle();
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url ?? "/", MOCK_GOOGLE_ORIGIN);
    const send = (status: number, payload?: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(payload === undefined ? "" : JSON.stringify(payload));
    };

    const admin = url.pathname.match(/^\/__admin\/(.+)$/);
    if (admin) {
      const [action, email] = admin[1]!.split("/").map(decodeURIComponent);
      try {
        if (action === "events" && req.method === "GET") {
          return send(200, fake.events(email!, url.searchParams.get("calendar") ?? email!));
        }
        if (action === "events" && req.method === "POST") {
          const { calendarId, ...event } = JSON.parse(body) as { calendarId?: string; id: string };
          fake.addEvent(email!, calendarId ?? email!, event);
          return send(200, {});
        }
        if (action === "revoke") {
          fake.revokeAll(email!);
          return send(200, {});
        }
        if (action === "fail") {
          fake.failNext(JSON.parse(body));
          return send(200, {});
        }
        if (action === "grant-next") {
          fake.nextGrant = JSON.parse(body) as { scope?: string; omitScope?: boolean };
          return send(200, {});
        }
        if (action === "deny-next") {
          fake.denyNext = true;
          return send(200, {});
        }
      } catch (error) {
        return send(400, { error: String(error) });
      }
      return send(404, {});
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
    }
    const response = fake.handle(req.method ?? "GET", url.toString(), headers, body);
    const payload =
      response.body === undefined || response.status === 204
        ? ""
        : typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body);
    res.writeHead(response.status, { "content-type": "application/json", ...response.headers });
    res.end(payload);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(MOCK_GOOGLE_PORT, "127.0.0.1", () => resolve(server));
  });
}
