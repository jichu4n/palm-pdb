import fs from 'fs-extra';
import path from 'path';
import {AddressDatabase} from '..';

describe('MemoDatabase', function () {
  describe('load test databases', function () {
    for (const dbFile of ['AddressDB-LifeDrive.pdb', 'AddressDB-Visor.pdb']) {
      test(`load test database ${dbFile}`, async function () {
        const buffer = await fs.readFile(
          path.join(__dirname, 'testdata', dbFile)
        );
        const db = AddressDatabase.from(buffer);

        expect(
          (db.appInfo?.categoryInfo.categories ?? []).map(({label}) => label)
        ).toStrictEqual(['Unfiled', 'Business', 'Personal', 'QuickList']);
        expect(db.records.length).toBeGreaterThan(0);
        for (const record of db.records) {
        }
      });
    }
  });

  /*
  test('serialize', async function () {
    // Create db1.
    const db1 = new MemoDatabase();
    db1.appInfo!.categoryInfo.categories = [
      {label: 'Unfiled', uniqId: 0, isRenamed: false},
      {label: 'Personal', uniqId: 1, isRenamed: false},
    ];
    for (let i = 0; i < 10; ++i) {
      const record = new MemoRecord();
      record.value = `Memo #${i}`;
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = MemoDatabase.from(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categoryInfo.categories).toStrictEqual(
      db1.appInfo?.categoryInfo.categories
    );
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
  */
});
