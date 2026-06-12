/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
const apiInternalUrl = (process.env.API_INTERNAL_URL || `http://127.0.0.1:${process.env.API_PORT || 4000}`).replace(/\/$/, "");
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "";
  }
})();
const connectSources = ["'self'"];
if (apiOrigin) connectSources.push(apiOrigin);
if (isDev) connectSources.push("http://localhost:4000", "http://127.0.0.1:4000", "ws://localhost:8080", "ws://127.0.0.1:8080");

const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src ${connectSources.join(" ")}`,
  "form-action 'self'"
].join("; ");

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp }
        ]
      }
    ];
  }
};
export default nextConfig;
