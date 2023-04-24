import fs from 'fs-extra';
import pick from 'lodash/pick';
import path from 'path';
import {Category, DatabaseDate, ToDoDatabase, ToDoRecord} from '..';

describe('ToDoDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'ToDoDB.pdb')
    );
    const db = ToDoDatabase.from(buffer);

    expect(db.header).toMatchObject(
      pick(new ToDoDatabase().header, ['name', 'type', 'creator'])
    );
    expect(db.appInfo?.categories.length).toStrictEqual(3);
    expect(db.records.length).toStrictEqual(3);
    for (const record of db.records) {
      expect(record.description.length).toBeGreaterThan(1);
      expect(record.priority).toStrictEqual(1);
      expect(record.isCompleted).toStrictEqual(false);
    }

    let dueDate0 = db.records[0].dueDate;
    expect(dueDate0?.year).toStrictEqual(2021);
    expect(dueDate0?.month).toStrictEqual(1);
    expect(dueDate0?.dayOfMonth).toStrictEqual(21);

    expect(db.records[2].dueDate).toBeNull();
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new ToDoDatabase();
    db1.appInfo!.categories = [
      Category.with({label: 'Unfiled', uniqId: 0, isRenamed: false}),
      Category.with({label: 'Personal', uniqId: 1, isRenamed: false}),
    ];
    for (let i = 0; i < 10; ++i) {
      const record = new ToDoRecord();
      record.description = `Task #${i}`;
      record.note = `Note #${i}`;
      record.priority = i + 1;
      record.isCompleted = !!(i % 2);
      if (i % 3) {
        record.dueDate = DatabaseDate.of(new Date(2000 + i, 0, 1));
      }
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = ToDoDatabase.from(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categories).toStrictEqual(db1.appInfo?.categories);
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
});
