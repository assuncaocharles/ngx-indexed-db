import { NgxIndexedDBService } from 'ngx-indexed-db';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'playground';
  storeName: string;
  storneNameToDelete: string;
  getAll$;

  bulkAdding = false;

  constructor(private dbService: NgxIndexedDBService) {
    this.getAll$ = this.dbService.getAll('people');
  }

  add(): void {
    //prepare random person data with or without email for count by index
    let randomPerson = {
      name: `charles number ${Math.random() * 10}`,
    };
    if (Math.random().toFixed(0) === '1') {
      randomPerson['email'] = `email number ${Math.random() * 10}`;
    }

    this.dbService.add('people', randomPerson).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  bulkAdd(): void {
    this.bulkAdding = true;

    const randomData: Array<any> = [];
    for (let i = 0; i < 200000; i++) {
      randomData.push({
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`,
      });
    }

    const startTime = performance.now();

    this.dbService.bulkAdd('people', randomData).subscribe({
      next: (results) => {
        const endTime = performance.now();
        console.log(`Bulk add performance: ${endTime - startTime} milliseconds`);
        console.log('result bulk add => ', results);
        this.bulkAdding = false;
      },
      error: (error) => {
        console.error('error bulk add => ', error);
        this.bulkAdding = false;
      },
    });
  }

  bulkAddWithErrors(): void {
    this.bulkAdding = true;
    const randomData: Array<any> = [];
    for (let i = 0; i < 200000; i++) {
      let item: any;
      if (i % 2 === 0) {
        item = { name: `charles number ${Math.random() * 10}`, email: Error };
      } else {
        item = { name: `charles number ${Math.random() * 10}`, email: `email number ${Math.random() * 10}` };
      }
      randomData.push(item);
    }

    const startTime = performance.now();

    this.dbService.bulkAdd('people', randomData).subscribe({
      next: (results) => {
        const endTime = performance.now();
        console.log(`Bulk add performance: ${endTime - startTime} milliseconds`);

        console.log('result bulk add => ', results);
        this.bulkAdding = false;
      },
      error: (error) => {
        console.error('error bulk add => ', error);
      },
      complete: () => {
        console.log('complete bulk add');
        this.bulkAdding = false;
      },
    });
  }

  addToTest(): void {
    this.dbService
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
    this.dbService.bulkGet('people', [1, 2]).subscribe((result) => {
      console.log('results: ', result);
    });
  }

  bulkPut(): void {
    const people = [];
    for (let i = 0; i < 100_000; ++i) {
      people.push({ name: `charles number ${Math.random() * 10}`, email: `email number ${Math.random() * 10}` });
    }
    this.dbService.bulkPut('people', people).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  update(): void {
    this.dbService.update('people', { id: 1, email: 'asd', name: 'charles' }).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  delete(): void {
    this.dbService.delete('people', 3).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  clean(): void {
    this.dbService.clear('people').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  count(): void {
    this.dbService.count('people').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  countByIndex(): void {
    this.dbService.countByIndex('people', 'email').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  bulkDelete(): void {
    this.dbService.bulkDelete('people', [5, 6]).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  deleteStore(): void {
    this.dbService.deleteObjectStore(this.storneNameToDelete).subscribe((result) => {
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

    this.dbService.createObjectStore(storeSchema);
  }

  getAll(): void {
    this.getAll$.subscribe((d) => {
      console.log(d);
    });
  }

  getByKey(): void {
    this.dbService.getByKey('people', 1).subscribe((d) => {
      console.log(d);
    });
  }

  getAllObjectStoreNames(): void {
    this.dbService.getAllObjectStoreNames().subscribe((storeNames: string[]): void => {
      console.log(storeNames);
    });
  }

  addTwoAndGetAllByIndex(): void {
    // #209 getAllByIndex with multiple result should resolve observable
    forkJoin([
      this.dbService.add('people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
      this.dbService.add('people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
    ])
      .pipe(switchMap(() => this.dbService.getAllByIndex('people', 'name', IDBKeyRange.only('desmond'))))
      .subscribe((result) => console.log(result));
  }

  testUpdateCursor() {
    this.dbService.openCursor('people', undefined, 'prev').subscribe((evt) => {
      const cursor = ((evt.target as IDBOpenDBRequest).result as unknown) as IDBCursorWithValue;

      if (cursor) {
        const item = cursor.value;

        item.name = `${item.name} ${Math.random() * 10}`;

        cursor.update(item);
        cursor.continue();
      } else {
        console.log('Not found');
      }
    });
  }

  public async versionDatabase(): Promise<void> {
    this.dbService
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
}
