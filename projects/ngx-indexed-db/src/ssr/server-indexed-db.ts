/**
 *
 * A class that implements the IDBFactory interface, but only for the server.
 * All methods return a mocked value.
 *
 */
export class ServerIndexedDB implements IDBFactory {
  cmp(first: unknown, second: unknown): number {
    return 0;
  }
  databases(): Promise<IDBDatabaseInfo[]> {
    return Promise.resolve([]);
  }

  deleteDatabase(name: string): IDBOpenDBRequest {
    return {
      onupgradeneeded: null,
      onblocked: null,
      onerror: null,
      onsuccess: null,
      error: null,
    } as IDBOpenDBRequest;
  }

  open(name: string, version: number): IDBOpenDBRequest {
    return {
      onupgradeneeded: null,
      onblocked: null,
      onerror: null,
      onsuccess: null,
      error: null,
    } as IDBOpenDBRequest;
  }
}
