/** Huella del archivo Excel original, independiente del nombre que muestra la interfaz. */
export async function fileFingerprint(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
