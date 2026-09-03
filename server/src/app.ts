import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import fs from "fs";
import { pool } from "./db";
import authRoutes from "./routes/auth";
import votesRoutes from "./routes/votes";
import turnoutRoutes from "./routes/turnout";
import resultsRoutes from "./routes/results";
import adminRoutes from "./routes/admin";
import { closeExpiredRoles } from "./lib/roleClosing";

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN?.split(",") ?? true,
      credentials: true,
    })
  );

  app.use(
    session({
      store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
      name: "stoba95.sid",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 6, // 6 hours
      },
    })
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // No scheduler in this app — sweep expired voting windows closed on the
  // way in to any request that could read or act on role state.
  app.use((_req, _res, next) => {
    closeExpiredRoles(pool)
      .catch((err) => console.error("closeExpiredRoles failed:", err))
      .finally(next);
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/votes", votesRoutes);
  app.use("/api/turnout", turnoutRoutes);
  app.use("/api/results", resultsRoutes);
  app.use("/api/admin", adminRoutes);

  // Single-deployable mode: serve the built client (and its client-side
  // routes, e.g. /admin) from this same service. No-op locally, where the
  // client runs on its own Vite dev server and this directory doesn't exist.
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
