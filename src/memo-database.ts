import pick from 'lodash/pick';
import {
  field,
  SerializeOptions,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {AppInfoType, DatabaseHdrType, PdbDatabase, PdbRecord} from '.';

/** MemoDB sort order. */
export enum MemoSortOrder {
  MANUAL = 0,
  ALPHABETICAL = 1,
}

/** MemoDB AppInfo block. */
export class MemoAppInfo extends AppInfoType {
  @field(SUInt16BE)
  private padding2 = 0;

  /** Memo sort order.
   *
   * New for 2.0 memo application.
   */
  @field(SUInt8.enum(MemoSortOrder))
  sortOrder = MemoSortOrder.MANUAL;

  @field(SUInt8)
  private padding3 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }
}

/** A MemoDB record. */
export class MemoRecord extends PdbRecord {
  /** Memo content. */
  @field(SStringNT)
  value = '';
}

/** MemoDB database.
 *
 * References:
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/memo.c
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Memo.pm
 */
export class MemoDatabase extends PdbDatabase.of(MemoRecord, MemoAppInfo) {
  header = DatabaseHdrType.with({
    name: 'MemoDB',
    type: 'DATA',
    creator: 'memo',
  });
}
