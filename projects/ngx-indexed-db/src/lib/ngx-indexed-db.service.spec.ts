import { TestBed } from '@angular/core/testing';

import { NgxIndexedDBService } from './ngx-indexed-db.service';

describe('NgxIndexedDBService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: NgxIndexedDBService = TestBed.get(NgxIndexedDBService);
		expect(service).toBeTruthy();
	});
});
