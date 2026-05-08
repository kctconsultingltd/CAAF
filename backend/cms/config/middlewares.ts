import type { Core } from "@strapi/strapi";

const config: Core.Config.Middlewares = [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
          "media-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
          // upgradeInsecureRequests intentionally omitted — useDefaults enables it
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      headers: ["Content-Type", "Authorization"],
      origin: [
        "https://caaf-iota.vercel.app",
        "https://caaf-2.vercel.app",
      ],
    },
  },
  "strapi::poweredBy",
  { name: "global::rate-limit", config: {} },
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];

export default config;
