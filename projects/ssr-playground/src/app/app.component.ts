import { DBMode, NgxIndexedDBService } from 'ngx-indexed-db';
import { forkJoin, Observable, Observer, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Person {
  id?: number;
  name: string;
  email?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [FormsModule, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly #dbService = inject(NgxIndexedDBService);

  protected readonly title = signal('ssr-playground');
  protected readonly storeName = signal('');
  protected readonly storeNameToDelete = signal('');
  protected readonly lastResult = signal<unknown>(null);


  add(): void {
    //prepare random person data with or without email for count by index
    const randomPerson: Person = {
      name: `charles number ${Math.random() * 10}`,
    };
    if (Math.random().toFixed(0) === '1') {
      randomPerson.email = `email number ${Math.random() * 10}`;
    }

    this.#run('add', this.#dbService.add('people', randomPerson));
  }

  bulkAdd(): void {
    const randomData: Person[] = [];
    for (let i = 0; i < 200000; i++) {
      randomData.push({
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`,
      });
    }
    this.#run('bulkAdd', this.#dbService.bulkAdd('people', randomData));
  }

  addToTest(): void {
    this.#run(
      'addToTest',
      this.#dbService
        .add('test', {
          name: `charles number`,
        })
        .pipe(
          catchError((x) => {
            console.log('in catchError', x);
            return of(x);
          })
        )
    );
  }

  bulkGet(): void {
    this.#run('bulkGet', this.#dbService.bulkGet('people', [1, 2]));
  }

  bulkPut(): void {
    const people: Person[] = [];
    for (let i = 0; i < 100_000; ++i) {
      people.push({ name: `charles number ${Math.random() * 10}`, email: `email number ${Math.random() * 10}` });
    }
    this.#run('bulkPut', this.#dbService.bulkPut('people', people));
  }

  update(): void {
    this.#run('update', this.#dbService.update('people', { id: 1, email: 'asd', name: 'charles' }));
  }

  delete(): void {
    this.#run('delete', this.#dbService.delete('people', 3));
  }

  clean(): void {
    this.#run('clear', this.#dbService.clear('people'));
  }

  count(): void {
    this.#run('count', this.#dbService.count('people'));
  }

  countByIndex(): void {
    this.#run('countByIndex', this.#dbService.countByIndex('people', 'email'));
  }

  bulkDelete(): void {
    this.#run('bulkDelete', this.#dbService.bulkDelete('people', [5, 6]));
  }

  deleteStore(): void {
    this.#run('deleteObjectStore', this.#dbService.deleteObjectStore(this.storeNameToDelete()));
  }

  createStore(): void {
    const storeSchema = {
      store: this.storeName(),
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: false } },
      ],
    };

    this.#dbService
      .createObjectStore(storeSchema)
      .then(() => this.lastResult.set({ createObjectStore: storeSchema.store }));
  }

  getAll(): void {
    this.#run('getAll', this.#dbService.getAll('people'));
  }

  getByKey(): void {
    this.#run('getByKey', this.#dbService.getByKey('people', 1));
  }

  deleteAllByIndex(): void {
    this.#run(
      'deleteAllByIndex',
      forkJoin([
        this.#dbService.add('people', {
          name: 'John',
          email: `email number ${Math.random() * 10}`,
        }),
        this.#dbService.add('people', {
          name: 'John',
          email: `email number ${Math.random() * 10}`,
        }),
      ]).pipe(switchMap(() => this.#dbService.deleteAllByIndex('people', 'name', IDBKeyRange.only('John'))))
    );
  }

  getAllObjectStoreNames(): void {
    this.#run('getAllObjectStoreNames', this.#dbService.getAllObjectStoreNames());
  }

  addTwoAndGetAllByIndex(): void {
    // #209 getAllByIndex with multiple result should resolve observable
    this.#run(
      'getAllByIndex',
      forkJoin([
        this.#dbService.add('people', {
          name: `desmond`,
          email: `email number ${Math.random() * 10}`,
        }),
        this.#dbService.add('people', {
          name: `desmond`,
          email: `email number ${Math.random() * 10}`,
        }),
      ]).pipe(switchMap(() => this.#dbService.getAllByIndex('people', 'name', IDBKeyRange.only('desmond'))))
    );
  }

  testUpdateCursorXTimes(x = 3) {
    this.#dbService
      .openCursor<Person>({
        storeName: 'people',
        direction: 'next',
        mode: DBMode.readwrite,
      })
      .subscribe({
        next: (cursor) => {
          const item = cursor.value;

          item.name = `${item.name} ${Math.random() * 10}`;

          cursor.update(item);

          if (--x > 0) {
            cursor.continue();
          }
        },
        complete: () => {
          console.log('No (other) records');
        },
      });
  }

  testUpdateCursor() {
    this.#dbService
      .openCursor<Person>({
        storeName: 'people',
        direction: 'prev',
        mode: DBMode.readwrite,
      })
      .subscribe({
        next: (cursor) => {
          const item = cursor.value;

          item.name = `${item.name} ${Math.random() * 10}`;

          cursor.update(item);
          cursor.continue();
        },
        complete: () => {
          console.log('No (other) records');
        },
      });
  }

  versionDatabase(): void {
    this.#run(
      'getDatabaseVersion',
      this.#dbService.getDatabaseVersion().pipe(
        catchError((err) => {
          console.error('Error recover version => ', err);
          return throwError(() => err);
        })
      )
    );
  }

  deleteDatabase(): void {
    this.#run('deleteDatabase', this.#dbService.deleteDatabase());
  }

  /** Subscribes to an operation, shows its result on the page. */
  #run<T>(operation: string, source: Observable<T>): void {
    const observer: Partial<Observer<T>> = {
      next: (result) => {
        console.log(`result ${operation} => `, result);
        this.lastResult.set({ [operation]: result });
      },
      error: (error) => {
        console.error(`error ${operation} => `, error);
        this.lastResult.set({ [operation]: 'error', error: String(error) });
      },
    };
    source.subscribe(observer);
  }
}
