import { NgxIndexedDBService } from './../../../ngx-indexed-db/src/lib/ngx-indexed-db.service';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'playground';

  constructor(private dbService: NgxIndexedDBService<any>) {}

  add(): void {
    this.dbService
      .add('people', {
        name: `charles number ${Math.random() * 10}`,
        email: `email number ${Math.random() * 10}`,
      })
      .subscribe((result) => {
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
}
