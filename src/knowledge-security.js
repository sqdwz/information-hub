export async function verifySecret(provided, expected, subtle = crypto.subtle) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    subtle.digest("SHA-256", encoder.encode(String(provided ?? ""))),
    subtle.digest("SHA-256", encoder.encode(String(expected ?? "")))
  ]);
  return subtle.timingSafeEqual(providedHash, expectedHash);
}
