const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { env } = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const { requestId, sanitizePayload, securityEvents } = require("./middleware/security");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'none'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"]
      }
    }
  }));
  app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    next();
  });
  app.use(cors({ origin: env.appUrl, credentials: true, maxAge: 600 }));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "200kb" }));
  app.use(sanitizePayload);
  app.use(securityEvents);
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(apiLimiter);

  app.get("/health", (req, res) => {
    res.json({
      success: true,
      message: "OpenDeploy API is healthy",
      data: { version: env.version, uptime: process.uptime(), requestId: req.id }
    });
  });

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
