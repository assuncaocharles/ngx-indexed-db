import { NgxIndexedDBService } from './../../../ngx-indexed-db/src/lib/ngx-indexed-db.service';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Component } from '@angular/core';
import { NgModel } from '@angular/forms';
import { DbDictionary } from '../enums/db-dictionary';
import { DBOptions } from '../../../ngx-indexed-db/src/lib/ngx-indexed-db.meta';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'playground';
  storeName: string;

  private db1Options: DBOptions = {name: DbDictionary.DB_1_NAME, version: 1};
  private db2Options: DBOptions = {name: DbDictionary.DB_2_NAME, version: 1};

  constructor(private dbService: NgxIndexedDBService) {}

  add(): void {
    this.dbService
      .add(this.db1Options, 'people', {
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`,
      })
      .subscribe((result) => {
        console.log('result: ', result);
      });

    this.dbService
      .add(this.db2Options, 'car', {
        name: `ferrari ${Math.random() * 10}`,
        color: `red ${Math.random() * 10}`,
      })
      .subscribe((result) => {
        console.log('result: ', result);
      });
  }

  update(): void {
    this.dbService.update(this.db1Options, 'people', { id: 1, email: 'asd', name: 'charles' }).subscribe((result) => {
      console.log('result: ', result);
    });
    this.dbService.update(this.db2Options, 'car', { id: 1, name: 'mercedes', color: 'blue' }).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  delete(): void {
    this.dbService.delete(this.db1Options,'people', 3).subscribe((result) => {
      console.log('result: ', result);
    });
    this.dbService.delete(this.db2Options, 'car', 3).subscribe((result) => {
      console.log('result: ', result);
    });
  }

  clean(): void {
    this.dbService.clear(this.db1Options, 'people').subscribe((result) => {
      console.log('result: ', result);
    });
    this.dbService.clear(this.db2Options, 'car').subscribe((result) => {
      console.log('result: ', result);
    });
  }

  count(): void {
    this.dbService.count(this.db1Options, 'people').subscribe((result) => {
      console.log('result: ', result);
    });
    this.dbService.count(this.db2Options,'car').subscribe((result) => {
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

    this.dbService.createObjectStore(this.db1Options, storeSchema);
    this.dbService.createObjectStore(this.db2Options, storeSchema);
  }

  addTwoAndGetAllByIndex(): void {
    // #209 getAllByIndex with multiple result should resolve observable
    forkJoin([
      this.dbService.add(this.db1Options,'people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
      this.dbService.add(this.db1Options,'people', {
        name: `desmond`,
        email: `email number ${Math.random() * 10}`,
      }),
    ])
      .pipe(switchMap(() => this.dbService.getAllByIndex(this.db1Options, 'people', 'name', IDBKeyRange.only('desmond'))))
      .subscribe((result) => console.log(result));
  }
}
