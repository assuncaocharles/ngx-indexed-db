import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { closeDatabase } from './ngx-indexed-db';

export function CloseDbConnection(): MethodDecorator {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);

      if (result instanceof Observable) {
        return result.pipe(
          finalize(async () => {
            const db: IDBDatabase | null = this.getDatabaseInstance();
            if (db) {
              await closeDatabase(db);
            }
          })
        );
      }
      return result;
    };
    return descriptor;
  };
}
