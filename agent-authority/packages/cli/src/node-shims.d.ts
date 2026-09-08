declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
  export function readFileSync(path: string, encoding: string): string;
}
declare const process: { argv: string[]; exit(code: number): never };
declare const console: { log(...args: any[]): void; error(...args: any[]): void };
