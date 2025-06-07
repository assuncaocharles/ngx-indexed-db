import { DBMode, NgxIndexedDBService } from 'ngx-indexed-db';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [FormsModule],
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'playground';
  storeName: string;
  storneNameToDelete: string;
  getAll$;

  readonly #dbService = inject(NgxIndexedDBService);

  constructor() {
    this.getAll$ = this.#dbService.getAll('people');
  }

  add(): void {
    //prepare random person data with or without email for count by index
    const randomPerson = {
      name: `charles number ${Math.random() * 10}`,
    };
    if (Math.random().toFixed(0) === '1') {
      randomPerson['email'] = `email number ${Math.random() * 10}`;
    }

    this.#dbService.add('people', randomPerson).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  bulkAdd(): void {
    const randomData: Array<any> = [];
    for (let i = 0; i < 200000; i++) {
      randomData.push({
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`,
      });
    }
    this.#dbService.bulkAdd('people', randomData).subscribe(
      (results) => {
        console.log('result bulk add => ', results);
      },
      (error) => {
        console.error('error bulk add => ', error);
      }
    );
  }

  addToTest(): void {
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
      .subscribe((result) => {
        console.log('result: ', result);
      });
  }

  bulkGet(): void {
    // for (let i = 0; i < 3; i++) {
    //   this.bulkAdd();
    // }
    this.#dbService.bulkGet('people', [1, 2]).subscribe((result) => {
      console.log('results: ', result);
    });
  }

  bulkPut(): void {
    const people = [];
    for (let i = 0; i < 100_000; ++i) {
      people.push({ name: `charles number ${Math.random() * 10}`, email: `email number ${Math.random() * 10}` });
    }
    this.#dbService.bulkPut('people', people).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  update(): void {
    this.#dbService.update('people', { id: 1, email: 'asd', name: 'charles' }).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  delete(): void {
    this.#dbService.delete('people', 3).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  clean(): void {
    this.#dbService.clear('people').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  count(): void {
    this.#dbService.count('people').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  countByIndex(): void {
    this.#dbService.countByIndex('people', 'email').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  bulkDelete(): void {
    this.#dbService.bulkDelete('people', [5, 6]).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  deleteStore(): void {
    this.#dbService.deleteObjectStore(this.storneNameToDelete).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  createStore(storeName: string): void {
    console.log('storeName', storeName);
    const storeSchema = {
      store: storeName,
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: false } },
      ],
    };

    this.#dbService.createObjectStore(storeSchema);
  }

  getAll(): void {
    this.getAll$.subscribe((d) => {
      console.log(d);
    });
  }

  getByKey(): void {
    this.#dbService.getByKey('people', 1).subscribe((d) => {
      console.log(d);
    });
  }

  deleteAllByIndex(): void {
    forkJoin([
      this.#dbService.add('people', {
        name: 'John',
        email: `email number ${Math.random() * 10}`,
      }),
      this.#dbService.add('people', {
        name: 'John',
        email: `email number ${Math.random() * 10}`,
      }),
    ])
      .pipe(
        switchMap((data1, data2) => {
          console.log(data1, data2);
          return this.#dbService.deleteAllByIndex('people', 'name', IDBKeyRange.only('John'));
        })
      )
      .subscribe((result) => console.log(result));
  }

  getAllObjectStoreNames(): void {
    this.#dbService.getAllObjectStoreNames().subscribe((storeNames: string[]): void => {
      console.log(storeNames);
    });
  }

  addTwoAndGetAllByIndex(): void {
    // #209 getAllByIndex with multiple result should resolve observable
    forkJoin([
      this.#dbService.add('people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
      this.#dbService.add('people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
    ])
      .pipe(switchMap(() => this.#dbService.getAllByIndex('people', 'name', IDBKeyRange.only('desmond'))))
      .subscribe((result) => console.log(result));
  }

  testUpdateCursorXTimes(x = 3) {
    this.#dbService
      .openCursor({
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
      .openCursor({
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

  public async versionDatabase(): Promise<void> {
    this.#dbService
      .getDatabaseVersion()
      .pipe(
        tap((response) => console.log('Versione database => ', response)),
        catchError((err) => {
          console.error('Error recover version => ', err);
          return throwError(err);
        })
      )
      .subscribe();
  }

  deleteDatabase(): void {
    this.#dbService.deleteDatabase().subscribe(
      () => {
        console.log('database deleted');
      },
      (error) => {
        console.error('error deleting database: ', error);
      }
    );
  }
}
