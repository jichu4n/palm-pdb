import fs from 'fs-extra';
import pick from 'lodash/pick';
import path from 'path';
import {Category, MemoDatabase, MemoRecord} from '..';

describe('MemoDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'MemoDB.pdb')
    );
    const db = MemoDatabase.from(buffer);

    expect(db.header).toMatchObject(
      pick(new MemoDatabase().header, ['name', 'type', 'creator'])
    );
    expect(db.appInfo?.categories.length).toStrictEqual(3);
    expect(db.records.length).toStrictEqual(5);
    for (const record of db.records) {
      expect(record.value.length).toBeGreaterThan(1);
    }
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new MemoDatabase();
    db1.appInfo!.categories = [
      Category.with({label: 'Unfiled', uniqId: 0, isRenamed: false}),
      Category.with({label: 'Personal', uniqId: 1, isRenamed: false}),
    ];
    db1.appInfo!.sortOrder = 1;
    for (let i = 0; i < 10; ++i) {
      const record = new MemoRecord();
      record.value = `Memo #${i}`;
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = MemoDatabase.from(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categories).toStrictEqual(db1.appInfo?.categories);
    expect(db2.appInfo?.sortOrder).toStrictEqual(db1.appInfo?.sortOrder);
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
});
