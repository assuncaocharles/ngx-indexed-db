export const appConfig: ApplicationConfig = {
  providers: [
    provideIndexedDb({
      name: 'MyDb',
      version: 1,
      objectStoresMeta: [
        {
          store: 'people',
          storeConfig: { keyPath: 'id', autoIncrement: true },
          storeSchema: [
            {
              name: 'email',
              keypath: 'email',
              options: { unique: true },
            },
          ],
        },
      ],
    }),
  ],
};
