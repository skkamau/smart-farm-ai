const defaultLocalClientUrls = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateEnv() {
  const missing = [];
  if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production" && String(process.env.JWT_SECRET).length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
}

export function allowedOrigins() {
  const configured = splitCsv(process.env.ALLOWED_ORIGINS);
  const clientUrl = process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [];
  const productionDefaults = [
    "https://smart-farm-ai-two.vercel.app",
    "https://smart-farm-ai-skkamaus-projects.vercel.app",
    "https://smart-farm-ai-git-main-skkamaus-projects.vercel.app"
  ];
  const localDefaults = process.env.NODE_ENV === "production" ? [] : defaultLocalClientUrls;
  return new Set([...configured, ...clientUrl, ...productionDefaults, ...localDefaults].filter(Boolean));
}

export function isLocalNetworkOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;
  return /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):517\d$/.test(origin);
}
