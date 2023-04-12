import {
  field,
  SerializeOptions,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {
  CategoryInfo,
  DatabaseHdrType,
  PdbDatabase,
  PdbRecord,
  RecordEntryType,
} from '.';

/** MemoDB database. */
export class MemoDatabase extends PdbDatabase<MemoRecord, MemoAppInfo> {
  recordType = MemoRecord;
  appInfoType = MemoAppInfo;

  get defaultHeader() {
    return DatabaseHdrType.with({
      name: 'MemoDB',
      type: 'DATA',
      creator: 'memo',
    });
  }

  appInfo = new MemoAppInfo();
}

/** MemoDB AppInfo block. */
export class MemoAppInfo extends SObject {
  @field()
  categoryInfo = new CategoryInfo();

  @field(SUInt16BE)
  padding1 = 0;

  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  @field(SUInt8)
  sortOrder = 0;

  @field(SUInt8)
  padding2 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }
}

/** A MemoDB record. */
export class MemoRecord extends SObject implements PdbRecord {
  entry: RecordEntryType = new RecordEntryType();

  /** Memo content. */
  @field(SStringNT)
  value: string = '';
}
