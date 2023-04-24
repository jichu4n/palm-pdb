import pick from 'lodash/pick';
import {
  DeserializeOptions,
  field,
  SerializeOptions,
  SStringNT,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {
  AppInfoType,
  DatabaseDate,
  DatabaseHdrType,
  OptionalDatabaseDate,
  PdbDatabase,
  PdbRecord,
} from '.';

/** ToDoDB AppInfo block. */
export class ToDoAppInfo extends AppInfoType {
  /** Not sure what this is ¯\_(ツ)_/¯ */
  @field(SUInt16BE)
  private dirty = 0;

  /** Item sort order.
   *
   * 0 = manual, 1 = sort by priority.
   */
  @field(SUInt8)
  sortOrder = 0;

  @field(SUInt8)
  private padding2 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }

  toJSON() {
    return {...super.toJSON(), ...pick(this, ['sortOrder'])};
  }
}

/** A ToDoDB record. */
export class ToDoRecord extends PdbRecord {
  /** Due date of the item (may be empty if there is no due date). */
  @field(OptionalDatabaseDate)
  dueDate: DatabaseDate | null = null;

  /** Attributes byte. */
  @field(SUInt8)
  private attrs = 0;

  /** Whether the item is completed. Stored inside attrs. */
  isCompleted = false;

  /** Priority of the item (max 127). Stored inside attrs. */
  priority = 0;

  /** Main description. */
  @field(SStringNT)
  description = '';

  /** Additional note. */
  @field(SStringNT)
  note = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const readOffset = super.deserialize(buffer, opts);
    this.isCompleted = !!(this.attrs & 0x80);
    this.priority = this.attrs & 0x7f;
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    if (this.priority < 0 || this.priority > 0x7f) {
      throw new Error(`Invalid priority: ${this.priority}`);
    }
    this.attrs = this.priority;
    if (this.isCompleted) {
      this.attrs |= 0x80;
    }
    return super.serialize(opts);
  }

  toJSON() {
    return pick(this, [
      'entry',
      'dueDate',
      'isCompleted',
      'priority',
      'description',
      'note',
    ]);
  }
}

/** ToDoDB database.
 *
 * References:
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/todo.c
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/ToDo.pm
 */
export class ToDoDatabase extends PdbDatabase.of(ToDoRecord, ToDoAppInfo) {
  header = DatabaseHdrType.with({
    name: 'ToDoDB',
    type: 'DATA',
    creator: 'todo',
  });
}
