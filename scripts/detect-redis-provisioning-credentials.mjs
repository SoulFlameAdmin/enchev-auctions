const CANDIDATES = [
  "VERCEL_TOKEN",
  "UPSTASH_API_KEY",
  "UPSTASH_EMAIL",
  "RAILWAY_TOKEN",
  "RENDER_API_KEY",
  "DIGITALOCEAN_ACCESS_TOKEN",
  "AIVEN_TOKEN",
  "REDIS_CLOUD_API_KEY",
  "REDIS_CLOUD_SECRET_KEY",
];

const present = CANDIDATES.filter((name) => Boolean(process.env[name]?.trim()));
const absent = CANDIDATES.filter((name) => !process.env[name]?.trim());

console.log(`REDIS_PROVISIONING_CREDENTIALS present=${present.length ? present.join(",") : "none"} absent_count=${absent.length}`);
