declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(data: string, encoding?: string): { digest(encoding: string): string } };
  export const randomUUID: () => string;
}
