import bcrypt from "bcrypt";

// Regla de negocio: todo tutor nuevo nace con esta contraseña (siempre cifrada)
export const DEFAULT_TUTOR_PASSWORD = "123456";
export const BCRYPT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 6;

export class PasswordValidationError extends Error {}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// Normaliza la contraseña que llega de un formulario:
// vacía (o solo espacios) => undefined ("no cambiar"); corta => error de validación.
export function parseNewPassword(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const plain = String(raw).trim();
  if (!plain) return undefined;
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  return plain;
}
