declare module 'node:fs/promises' {
  export function readFile(path: string): Promise<Uint8Array>;
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
}
declare module 'node:path' {
  const path: { join(...parts: string[]): string };
  export default path;
}
declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
}
declare const process: { cwd(): string };
