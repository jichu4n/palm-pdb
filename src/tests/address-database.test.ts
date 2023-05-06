import fs from 'fs-extra';
import pick from 'lodash/pick';
import path from 'path';
import {SObject, SStringNT} from 'serio';
import {
  AddressCountry,
  AddressDatabase,
  AddressFieldType,
  PHONE_NUMBER_FIELD_TYPES,
  PhoneNumberType,
} from '..';

async function loadTestDbAndDoBasicChecks(dbFile: string, encoding?: string) {
  const buffer = await fs.readFile(path.join(__dirname, 'testdata', dbFile));
  const db = AddressDatabase.from(buffer, {encoding});

  expect(db.header).toMatchObject(
    pick(new AddressDatabase().header, ['name', 'type', 'creator'])
  );
  expect((db.appInfo?.categories ?? []).length).toBeGreaterThan(0);
  expect(db.records.length).toBeGreaterThan(0);
  for (const record of db.records) {
    expect(record.cells.length).toBeGreaterThan(0);
    expect(Object.keys(record.phoneNumberTypeMapping)).toStrictEqual(
      PHONE_NUMBER_FIELD_TYPES.map((t) => t.toString())
    );
  }
  return db;
}

function mapToJson(array: Array<SObject>) {
  return array.map((e) => e.toJSON());
}

describe('AddressDatabase', function () {
  describe('load test databases', function () {
    test(`load test database AddressDB-LifeDrive.pdb`, async function () {
      const db = await loadTestDbAndDoBasicChecks('AddressDB-LifeDrive.pdb');
      expect(mapToJson(db.appInfo!.categories)).toStrictEqual([
        {
          label: 'Unfiled',
          uniqId: 0,
          isRenamed: true,
        },
        {
          label: 'Business',
          uniqId: 1,
          isRenamed: true,
        },
        {
          label: 'Personal',
          uniqId: 2,
          isRenamed: true,
        },
        {
          label: 'QuickList',
          uniqId: 3,
          isRenamed: true,
        },
      ]);
      expect(db.appInfo?.fields).toStrictEqual([
        {
          type: AddressFieldType.LAST_NAME,
          label: 'Last name',
          isRenamed: true,
        },
        {
          type: AddressFieldType.FIRST_NAME,
          label: 'First name',
          isRenamed: false,
        },
        {
          type: AddressFieldType.COMPANY,
          label: 'Company',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_1,
          label: 'Work',
          isRenamed: false,
        },
        {
          type: AddressFieldType.PHONE_2,
          label: 'Home',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_3,
          label: 'Fax',
          isRenamed: false,
        },
        {
          type: AddressFieldType.PHONE_4,
          label: 'Other',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_5,
          label: 'E-mail',
          isRenamed: false,
        },
        {
          type: AddressFieldType.ADDRESS,
          label: 'Addr(W)',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CITY,
          label: 'City',
          isRenamed: false,
        },
        {
          type: AddressFieldType.STATE,
          label: 'State',
          isRenamed: true,
        },
        {
          type: AddressFieldType.ZIP_CODE,
          label: 'Zip Code',
          isRenamed: false,
        },
        {
          type: AddressFieldType.COUNTRY,
          label: 'Country',
          isRenamed: true,
        },
        {
          type: AddressFieldType.TITLE,
          label: 'Title',
          isRenamed: false,
        },
        {
          type: AddressFieldType.CUSTOM_1,
          label: 'Custom 1',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CUSTOM_2,
          label: 'Custom 2',
          isRenamed: false,
        },
        {
          type: AddressFieldType.CUSTOM_3,
          label: 'Custom 3',
          isRenamed: false,
        },
        {
          type: AddressFieldType.CUSTOM_4,
          label: 'Custom 4',
          isRenamed: false,
        },
        {
          type: AddressFieldType.NOTE,
          label: 'Note',
          isRenamed: false,
        },
        {
          type: AddressFieldType.PHONE_6,
          label: 'Main',
          isRenamed: false,
        },
        {
          type: AddressFieldType.PHONE_7,
          label: 'Pager',
          isRenamed: false,
        },
        {
          type: AddressFieldType.PHONE_8,
          label: 'Mobile',
          isRenamed: false,
        },
      ]);
      expect(db.appInfo?.country).toStrictEqual(AddressCountry.UNITED_STATES);
      expect(db.records).toHaveLength(2);
      expect(db.records[1].phoneNumberTypeMapping).toStrictEqual({
        [AddressFieldType.PHONE_1]: PhoneNumberType.MAIN,
        [AddressFieldType.PHONE_2]: PhoneNumberType.OTHER,
        [AddressFieldType.PHONE_3]: PhoneNumberType.MOBILE,
        [AddressFieldType.PHONE_4]: PhoneNumberType.EMAIL,
        [AddressFieldType.PHONE_5]: PhoneNumberType.MAIN,
      });
      expect(db.records[1].cells).toStrictEqual([
        {
          fieldType: AddressFieldType.LAST_NAME,
          value: 'Technical Support',
        },
        {
          fieldType: AddressFieldType.COMPANY,
          value: 'palmOne, Inc.',
        },
        {
          fieldType: AddressFieldType.PHONE_1,
          phoneNumberType: PhoneNumberType.MAIN,
          value: 'www.palmOne.com/support',
        },
        {
          fieldType: AddressFieldType.PHONE_2,
          phoneNumberType: PhoneNumberType.OTHER,
          value: "Int'l: www.palmOne.com/support/intl",
        },
        {
          fieldType: AddressFieldType.NOTE,
          value:
            'For the latest information on products and upgrades, check our web site regularly.',
        },
      ]);
    });
    test(`load test database AddressDB-Palm V-JP.pdb`, async function () {
      const db = await loadTestDbAndDoBasicChecks(
        'AddressDB-Palm V-JP.pdb',
        'shiftjis'
      );
      expect(mapToJson(db.appInfo!.categories)).toStrictEqual([
        {
          label: '未分類',
          uniqId: 0,
          isRenamed: true,
        },
        {
          label: 'ビジネス',
          uniqId: 1,
          isRenamed: true,
        },
        {
          label: 'パーソナル',
          uniqId: 2,
          isRenamed: true,
        },
        {
          label: 'クイックリスト',
          uniqId: 3,
          isRenamed: true,
        },
      ]);
      expect(db.appInfo?.fields).toStrictEqual([
        {
          type: AddressFieldType.LAST_NAME,
          label: '姓',
          isRenamed: true,
        },
        {
          type: AddressFieldType.FIRST_NAME,
          label: '名',
          isRenamed: true,
        },
        {
          type: AddressFieldType.COMPANY,
          label: '会社名',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_1,
          label: '会社',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_2,
          label: '自宅',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_3,
          label: 'Fax',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_4,
          label: 'その他',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_5,
          label: 'E-mail',
          isRenamed: true,
        },
        {
          type: AddressFieldType.ADDRESS,
          label: '住所',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CITY,
          label: '市町村',
          isRenamed: true,
        },
        {
          type: AddressFieldType.STATE,
          label: '都道府県',
          isRenamed: true,
        },
        {
          type: AddressFieldType.ZIP_CODE,
          label: '郵便番号',
          isRenamed: true,
        },
        {
          type: AddressFieldType.COUNTRY,
          label: '国',
          isRenamed: true,
        },
        {
          type: AddressFieldType.TITLE,
          label: '役職',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CUSTOM_1,
          label: 'カスタム 1',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CUSTOM_2,
          label: 'カスタム 2',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CUSTOM_3,
          label: 'カスタム 3',
          isRenamed: true,
        },
        {
          type: AddressFieldType.CUSTOM_4,
          label: 'カスタム 4',
          isRenamed: true,
        },
        {
          type: AddressFieldType.NOTE,
          label: 'ｺﾒﾝﾄ',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_6,
          label: '代表',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_7,
          label: 'ポケベル',
          isRenamed: true,
        },
        {
          type: AddressFieldType.PHONE_8,
          label: '携帯',
          isRenamed: true,
        },
      ]);
      expect(db.appInfo?.country).toStrictEqual(AddressCountry.JAPAN);
      expect(db.records).toHaveLength(1);
      expect(db.records[0].phoneNumberTypeMapping).toStrictEqual({
        [AddressFieldType.PHONE_1]: PhoneNumberType.WORK,
        [AddressFieldType.PHONE_2]: PhoneNumberType.HOME,
        [AddressFieldType.PHONE_3]: PhoneNumberType.FAX,
        [AddressFieldType.PHONE_4]: PhoneNumberType.OTHER,
        [AddressFieldType.PHONE_5]: PhoneNumberType.EMAIL,
      });
      expect(db.records[0].cells).toStrictEqual([
        {
          fieldType: AddressFieldType.LAST_NAME,
          value: '田中\u0001たなか',
        },
        {
          fieldType: AddressFieldType.FIRST_NAME,
          value: '太郎\u0001たろう',
        },
        {
          fieldType: AddressFieldType.ADDRESS,
          value: '港区六本木6丁目10ー1',
        },
        {
          fieldType: AddressFieldType.STATE,
          value: '東京都',
        },
        {
          fieldType: AddressFieldType.ZIP_CODE,
          value: '106-6126',
        },
        {
          fieldType: AddressFieldType.COUNTRY,
          value: '日本',
        },
      ]);
    });
    test(`load test database AddressDB-Palm V-FR.pdb`, async function () {
      const db = await loadTestDbAndDoBasicChecks('AddressDB-Palm V-FR.pdb');
      expect(db.appInfo?.country).toStrictEqual(AddressCountry.FRANCE);
      expect(db.records).toHaveLength(2);
    });
  });

  describe('serialize', function () {
    test(`using test database AddressDB-LifeDrive.pdb`, async function () {
      const db1 = await loadTestDbAndDoBasicChecks('AddressDB-LifeDrive.pdb');
      const db2 = AddressDatabase.from(db1.serialize());
      expect(db2.records).toHaveLength(db1.records.length);
      for (let i = 0; i < db1.records.length; ++i) {
        const rec1 = db1.records[i];
        const rec2 = db2.records[i];
        expect(rec2.mainPhoneNumberType).toStrictEqual(
          rec1.mainPhoneNumberType
        );
        expect(rec2.phoneNumberTypeMapping).toStrictEqual(
          rec1.phoneNumberTypeMapping
        );
        expect((rec2 as any)['companyCellValueOffset']).toBeGreaterThan(0);
        expect((rec2 as any)['companyCellValueOffset']).toStrictEqual(
          (rec1 as any)['companyCellValueOffset']
        );
        expect(
          SStringNT.from(
            rec2
              .serialize()
              .subarray(9 + (rec2 as any)['companyCellValueOffset'] - 1)
          ).value
        ).toStrictEqual(rec1.get(AddressFieldType.COMPANY));
        expect(rec2.cells).toStrictEqual(rec1.cells);
      }
    });
  });
});
