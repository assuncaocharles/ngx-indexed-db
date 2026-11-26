export class PeopleService {
  private readonly db = inject(NgxIndexedDBService);

  add(person: Person) {
    return this.db.add<Person>('people', person);
  }

  findByEmail(email: string) {
    return this.db.getByIndex<Person>('people', 'email', email);
  }

  readonly people = toSignal(this.db.getAll<Person>('people'));
}
