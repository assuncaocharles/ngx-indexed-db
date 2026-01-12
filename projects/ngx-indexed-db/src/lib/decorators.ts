import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { closeDatabase, openedDatabases } from './ngx-indexed-db';

export function CloseDbConnection(): MethodDecorator {
  return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const result = originalMethod.apply(this, args);

      if (result instanceof Observable) {
        return result.pipe(
          finalize(async () => {
            const promises = openedDatabases.map(async (db: IDBDatabase) => {
              await closeDatabase(db);
            });
            await Promise.all(promises);
            openedDatabases.length = 0;
          })
        );
      }
      return result;
    };
    return descriptor;
  };
}
