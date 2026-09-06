// İki backend'e de aynı frontend konuşuyor. Yerelde iki ayrı porta,
// canlıda Caddy üzerinden aynı domain'in farklı yollarına gider.
export const SERVICE_A_URL = process.env.NEXT_PUBLIC_SERVICE_A_URL ?? "http://localhost:8000";
export const SERVICE_B_URL = process.env.NEXT_PUBLIC_SERVICE_B_URL ?? "http://localhost:8080";
