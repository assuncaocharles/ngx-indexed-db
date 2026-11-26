import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { SeoService } from '../core/seo.service';
import { Person, PLAYGROUND_DB, randomPerson } from './playground.config';

type IndexName = 'name' | 'email' | 'age';
type Operator = 'eq' | 'prefix' | 'gte';

interface LogEntry {
  id: number;
  call: string;
  ok: boolean;
  ms: number;
  result: string;
}

const STORE = 'people';

@Component({
  selector: 'docs-playground',
  imports: [FormsModule, RouterLink],
  templateUrl: './playground.html',
  styleUrl: './playground.css',
})
export class Playground {
  private readonly db = inject(NgxIndexedDBService);

  protected readonly dbName = PLAYGROUND_DB.name;
  protected readonly people = signal<Person[]>([]);
  protected readonly log = signal<LogEntry[]>([]);
  protected readonly ready = signal(false);
  protected readonly filter = signal<string | null>(null);

  protected readonly draft = { name: '', email: '', age: 30 };
  protected query: { index: IndexName; op: Operator; value: string } = { index: 'name', op: 'prefix', value: 'A' };

  protected readonly operators = computed(() => [
    { id: 'eq' as const, label: 'equals' },
    { id: 'prefix' as const, label: 'starts with' },
    { id: 'gte' as const, label: '≥' },
  ]);

  private nextLogId = 0;

  constructor() {
    inject(SeoService).set({
      title: 'Playground',
      description: 'Try ngx-indexed-db live: real IndexedDB in your browser, with every call logged.',
    });
    // IndexedDB only exists in the browser; the prerendered page shows an empty table.
    afterNextRender(() => this.refresh());
  }

  protected refresh(): void {
    this.filter.set(null);
    this.run(`getAll('${STORE}')`, this.db.getAll<Person>(STORE), (people) => {
      this.people.set(people);
      this.ready.set(true);
      return `${people.length} records`;
    });
  }

  protected add(): void {
    const person: Person = {
      name: this.draft.name.trim(),
      email: this.draft.email.trim(),
      age: Number(this.draft.age),
    };
    if (!person.name || !person.email) return;
    this.run(`add('${STORE}', ${json(person)})`, this.db.add<Person>(STORE, person), (stored) => {
      this.people.update((list) => [...list, stored]);
      this.draft.name = '';
      this.draft.email = '';
      return json(stored);
    });
  }

  protected addRandom(count = 3): void {
    const batch = Array.from({ length: count }, randomPerson);
    this.run(`bulkAdd('${STORE}', [ ${count} people ])`, this.db.bulkAdd<Person>(STORE, batch), (keys) => {
      this.reloadSilently();
      return json(keys);
    });
  }

  /** Re-uses the email of the first record to show how a unique index rejects duplicates. */
  protected addDuplicate(): void {
    const first = this.people()[0];
    if (!first) return;
    const copy: Person = { name: 'Duplicate', email: first.email, age: 1 };
    this.run(`add('${STORE}', { …, email: '${first.email}' })`, this.db.add<Person>(STORE, copy), (stored) =>
      json(stored),
    );
  }

  protected birthday(person: Person): void {
    const updated = { ...person, age: person.age + 1 };
    this.run(
      `update('${STORE}', { id: ${person.id}, …, age: ${updated.age} })`,
      this.db.update<Person>(STORE, updated),
      (stored) => {
        this.people.update((list) => list.map((p) => (p.id === stored.id ? stored : p)));
        return json(stored);
      },
    );
  }

  protected remove(person: Person): void {
    this.run(`deleteByKey('${STORE}', ${person.id})`, this.db.deleteByKey(STORE, person.id!), () => {
      this.people.update((list) => list.filter((p) => p.id !== person.id));
      return 'deleted';
    });
  }

  protected count(): void {
    this.run(`count('${STORE}')`, this.db.count(STORE), (n) => String(n));
  }

  protected clear(): void {
    this.run(`clear('${STORE}')`, this.db.clear(STORE), () => {
      this.people.set([]);
      this.filter.set(null);
      return 'store is empty';
    });
  }

  protected runQuery(): void {
    const { index, op } = this.query;
    const raw = this.query.value.trim();
    if (!raw) return;
    const value: string | number = index === 'age' ? Number(raw) : raw;
    let range: IDBKeyRange;
    let rangeCode: string;
    if (op === 'eq') {
      range = IDBKeyRange.only(value);
      rangeCode = `IDBKeyRange.only(${json(value)})`;
    } else if (op === 'gte' || typeof value === 'number') {
      range = IDBKeyRange.lowerBound(value);
      rangeCode = `IDBKeyRange.lowerBound(${json(value)})`;
    } else {
      range = IDBKeyRange.bound(value, value + '￿');
      rangeCode = `IDBKeyRange.bound(${json(value)}, ${json(value)} + '\\uffff')`;
    }
    const label = `${index} ${this.operators().find((o) => o.id === op)?.label} ${raw}`;
    this.run(
      `getAllByIndex('${STORE}', '${index}', ${rangeCode})`,
      this.db.getAllByIndex<Person>(STORE, index, range),
      (people) => {
        this.people.set(people);
        this.filter.set(label);
        return `${people.length} matching records`;
      },
    );
  }

  protected clearLog(): void {
    this.log.set([]);
  }

  private reloadSilently(): void {
    this.db.getAll<Person>(STORE).subscribe((people) => {
      this.people.set(people);
      this.filter.set(null);
    });
  }

  /** Subscribes to a service call and records it in the activity log. */
  private run<T>(call: string, source: Observable<T>, onResult: (value: T) => string): void {
    const started = performance.now();
    const entry = (ok: boolean, result: string) =>
      this.log.update((log) =>
        [
          { id: this.nextLogId++, call, ok, ms: Math.round((performance.now() - started) * 10) / 10, result },
          ...log,
        ].slice(0, 40),
      );
    source.subscribe({
      next: (value) => entry(true, truncate(onResult(value))),
      error: (error: unknown) => entry(false, describeError(error)),
    });
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ');
}

function truncate(text: string, max = 220): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** IndexedDB reports failures as request events; surface the DOMException message. */
function describeError(error: unknown): string {
  const target = (error as Event | undefined)?.target as IDBRequest | undefined;
  const domError = target?.error ?? (error instanceof Error ? error : undefined);
  return domError ? `${domError.name}: ${domError.message}` : String(error);
}
