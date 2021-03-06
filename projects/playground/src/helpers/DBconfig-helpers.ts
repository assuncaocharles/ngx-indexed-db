import { DBConfig } from '../../../ngx-indexed-db/src/lib/ngx-indexed-db.meta';
import { DbDictionary } from '../enums/db-dictionary';

export function dbConfigs(): Array<DBConfig> {
  return [
    {
      name: DbDictionary.DB_1_NAME,
      version: 1,
      objectStoresMeta: [
        {
          store: 'people',
          storeConfig: { keyPath: 'id', autoIncrement: true },
          storeSchema: [
            { name: 'name', keypath: 'name', options: { unique: false } },
            { name: 'email', keypath: 'email', options: { unique: false } }
          ]
        }
      ]
    },
    {
      name: DbDictionary.DB_2_NAME,
      version: 1,
      objectStoresMeta: [
        {
          store: 'car',
          storeConfig: { keyPath: 'id', autoIncrement: true },
          storeSchema: [
            { name: 'name', keypath: 'name', options: { unique: false } },
            { name: 'color', keypath: 'color', options: { unique: false } }
          ]
        }
      ]
    }
  ];
}
