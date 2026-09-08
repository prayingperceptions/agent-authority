declare module 'node:crypto' {
  export type KeyObject = any;
  export function generateKeyPairSync(type: string): { publicKey: any; privateKey: any };
  export function createPrivateKey(args: any): any;
  export function createPublicKey(args: any): any;
  export function sign(algorithm: any, data: any, key: any): { toString(encoding: string): string };
  export function verify(algorithm: any, data: any, key: any, signature: any): boolean;
  export function randomUUID(): string;
}

declare const Buffer: {
  from(input: string, encoding?: string): any;
};
