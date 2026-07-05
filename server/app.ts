import express from "express";
import cors, { CorsOptions } from "cors";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";

export const getCorsOrigins = () =>
  (
    process.env.CORS_ORIGIN ??
    "http://localhost:5173,http://localhost:5174,https://splitnests.netlify.app"
  )
    .split(",")
    .map((o) => o.trim());

export function createApp() {
  const app = express();

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      const allowed = getCorsOrigins();

      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };

  app.use(cors(corsOptions));

  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api", apiRouter);

  return app;
}
