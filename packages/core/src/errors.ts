/** Marks a pipeline step or adapter whose contract exists but isn't wired yet. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`not implemented yet: ${what}`);
    this.name = "NotImplementedError";
  }
}
