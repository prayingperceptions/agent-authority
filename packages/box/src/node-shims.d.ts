declare module 'node:child_process' {
  export type ChildProcess = any;
  export function spawn(command: string, args: string[], options?: any): any;
}
declare module 'node:fs/promises' {
  export function mkdtemp(prefix: string): Promise<string>;
  export function rm(path: string, options?: any): Promise<void>;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(path: string): boolean;
}
declare module 'node:crypto' {
  export function randomUUID(): string;
}
declare const process: { env: Record<string, string | undefined> };
