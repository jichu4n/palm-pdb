import fs from 'fs-extra';
import path from 'path';
import {RawPdbDatabase} from '..';

describe('RawPdbDatabase', function () {
  test('load and serialize test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'ExpenseDB.pdb')
    );
    const db = RawPdbDatabase.from(buffer);
    console.log(db.toJSON());
    expect(db.header).toMatchObject({
      name: 'ExpenseDB',
      type: 'DATA',
      creator: 'exps',
    });
    expect(db.records.length).toStrictEqual(0);

    const buffer2 = db.serialize();
    expect(buffer2).toStrictEqual(buffer);
    const db2 = RawPdbDatabase.from(buffer2);
    const buffer3 = db2.serialize();
    expect(buffer3).toStrictEqual(buffer);
  });
});
