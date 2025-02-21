import {
  DeserializeOptions,
  field,
  json,
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

/** ToDoDB item sort order. */
export enum ToDoSortOrder {
  MANUAL = 0,
  PRIORITY = 1,
}

/** ToDoDB AppInfo block. */
export class ToDoAppInfo extends AppInfoType {
  /** Not sure what this is ¯\_(ツ)_/¯ */
  @field(SUInt16BE)
  @json(false)
  private dirty = 0;

  /** Item sort order. */
  @field(SUInt8.enum(ToDoSortOrder))
  sortOrder = ToDoSortOrder.MANUAL;

  @field(SUInt8)
  @json(false)
  private padding2 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }
}

/** A ToDoDB record. */
export class ToDoRecord extends PdbRecord {
  /** Due date of the item (may be empty if there is no due date). */
  @field(OptionalDatabaseDate)
  dueDate: DatabaseDate | null = null;

  /** Attributes byte. */
  @field(SUInt8)
  @json(false)
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
