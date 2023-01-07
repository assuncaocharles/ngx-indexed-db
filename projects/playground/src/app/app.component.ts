import { NgxIndexedDBService } from './../../../ngx-indexed-db/src/lib/ngx-indexed-db.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
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

  constructor(private dbService: NgxIndexedDBService) {
    this.getAll$ = this.dbService.getAll('people');
  }

  add(): void {
    //prepare random person data with or without email for count by index
    let randomPerson = {
      name: `charles number ${Math.random() * 10}`,
    }
    if (Math.random().toFixed(0) === '1') {
      randomPerson['email'] = `email number ${Math.random() * 10}`;
    }

    this.dbService
      .add('people', randomPerson)
      .subscribe((result) => {
        console.log('result: ', result);
      });
  }


  bulkAdd(): void {
    const randomData: Array<any> = [];
    for (let i = 0; i < 200000; i++) {
      randomData.push({
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`
      });
    }
    this.dbService.bulkAdd('people', randomData).subscribe(
      results => {
        console.log('result bulk add => ', results);
      }, error => {
        console.error('error bulk add => ', error);
      }
    );
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
    for (let i = 0; i < 3; i++) {
      this.bulkAdd();
    }
    this.dbService.bulkGet('people', [1, 3, 5]).subscribe((result) => {
      console.log('results: ', result);
    });
  }

  bulkPut(): void {
    const people = [];
    for (let i = 0; i < 100_000; ++i) {
      people.push({name: `charles number ${Math.random() * 10}`, email: `email number ${Math.random() * 10}`});
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
}
