import { DBConfig } from 'ngx-indexed-db';

export interface Person {
  id?: number;
  name: string;
  email: string;
  age: number;
}

/** A dedicated database so the playground never touches anything else on this origin. */
export const PLAYGROUND_DB: DBConfig = {
  name: 'ngx-indexed-db-playground',
  version: 1,
  objectStoresMeta: [
    {
      store: 'people',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: true } },
        { name: 'age', keypath: 'age', options: { unique: false } },
      ],
    },
  ],
};

const PEOPLE: [string, string][] = [
  ['Ada Lovelace', 'ada'],
  ['Alan Turing', 'alan'],
  ['Grace Hopper', 'grace'],
  ['Katherine Johnson', 'katherine'],
  ['Edsger Dijkstra', 'edsger'],
  ['Barbara Liskov', 'barbara'],
  ['Donald Knuth', 'donald'],
  ['Margaret Hamilton', 'margaret'],
  ['Tim Berners-Lee', 'tim'],
  ['Frances Allen', 'frances'],
  ['Ken Thompson', 'ken'],
  ['Radia Perlman', 'radia'],
];

/** A random person with an email that is very unlikely to collide with the unique index. */
export function randomPerson(): Person {
  const [name, handle] = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return { name, email: `${handle}.${suffix}@example.com`, age: 18 + Math.floor(Math.random() * 60) };
}
