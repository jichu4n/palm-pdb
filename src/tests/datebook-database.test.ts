import fs from 'fs-extra';
import path from 'path';
import {
  AlarmSettings,
  DatabaseDate,
  DatebookDatabase,
  DatebookRecord,
  OptionalDatabaseDate,
  RecurrenceSettings,
  RecurrenceFrequency,
  AlarmTimeUnit,
} from '..';

describe('DatebookDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'DatebookDB.pdb')
    );
    const db = DatebookDatabase.from(buffer);

    expect(db.records.length).toStrictEqual(3);
    for (const record of db.records) {
      expect(record.date.year).toStrictEqual(2021);
      expect(record.date.month).toStrictEqual(2);
      expect(record.startTime.value?.hour).toBeGreaterThan(0);
      expect(record.startTime.value?.minute).toStrictEqual(0);
      expect(record.endTime.value?.hour).toBeGreaterThan(0);
      expect(record.endTime.value?.minute).toStrictEqual(0);
      expect(record.description.length).toBeGreaterThan(1);
    }
    expect(db.records[0].recurrenceSettings).toStrictEqual({
      frequency: RecurrenceFrequency.WEEKLY,
      daysOfWeek: [false, false, false, false, false, false, true],
      startOfWeek: 0,
      interval: 1,
      endDate: new OptionalDatabaseDate(),
    });
    expect(db.records[0].recurrenceSettings?.interval).toStrictEqual(1);
    expect(db.records[0].recurrenceSettings?.endDate.value).toBeNull();
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new DatebookDatabase();
    for (let i = 0; i < 30; ++i) {
      const record = new DatebookRecord();
      record.description = `Event #${i}`;
      record.note = `Note #${i}`;
      record.date.year = 2000 + i;
      if (i % 2) {
        record.startTime.value = {hour: i % 24, minute: 0};
        record.endTime.value = {hour: i % 24, minute: 30};
      }
      if (i % 3) {
        record.alarmSettings = {unit: AlarmTimeUnit.MINUTES, value: i};
      }
      if (i % 10 === 0) {
        record.recurrenceSettings = null;
      } else {
        if (i < 7) {
          record.recurrenceSettings = {
            frequency: RecurrenceFrequency.WEEKLY,
            daysOfWeek: [false, false, false, false, false, false, false],
            startOfWeek: 0,
            interval: 1,
            endDate: new OptionalDatabaseDate(),
          };
          for (let j = 0; j < i; j += 2) {
            record.recurrenceSettings.daysOfWeek[j] = true;
          }
        } else if (i < 15) {
          record.recurrenceSettings = {
            frequency: RecurrenceFrequency.MONTHLY_BY_DAY,
            weekOfMonth: i % 6,
            dayOfWeek: i % 7,
            interval: 1,
            endDate: new OptionalDatabaseDate(),
          };
        } else {
          const frequencies = [
            RecurrenceFrequency.DAILY,
            RecurrenceFrequency.MONTHLY_BY_DATE,
            RecurrenceFrequency.YEARLY,
          ] as const;
          const frequency = frequencies[i % frequencies.length];
          record.recurrenceSettings = {
            frequency,
            interval: i,
            endDate: new OptionalDatabaseDate(),
          };
        }
        if (i % 4 && record.recurrenceSettings) {
          record.recurrenceSettings.endDate.value = DatabaseDate.with({
            year: 2001 + i,
          });
        }
      }
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = DatebookDatabase.from(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categoryInfo.categories).toStrictEqual(
      db1.appInfo?.categoryInfo.categories
    );
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
});
