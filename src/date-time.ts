import {
  DeserializeOptions,
  SUInt16BE,
  SerializableWrapper,
  SerializeOptions,
} from 'serio';

/** Standard epoch on Palm OS -- 1904/1/1. */
export const PDB_EPOCH = new Date('1904-01-01T00:00:00.000Z');
/** Standard UNIX epoch. */
export const UNIX_EPOCH = new Date(0);

/** Epoch that a DatabaseTimestamp value is based on. */
export enum EpochType {
  /** Standard epoch on Palm OS -- 1904/1/1. */
  PDB = 'pdb',
  /** UNIX epoch -- 1970/1/1. */
  UNIX = 'unix',
}

/** A timestamp value.
 *
 * References:
 *   - https://wiki.mobileread.com/wiki/PDB#PDB_Times
 */
export class DatabaseTimestamp extends SerializableWrapper<Date> {
  /** JavaScript Date value corresponding to the time. */
  value: Date = new Date();
  /** The epoch to use when serializing this date. */
  epochType = EpochType.PDB;

  /** Parses a PDB timestamp.
   *
   * If the time has the top bit set, it's an unsigned 32-bit number counting
   * from 1st Jan 1904.
   *
   * If the time has the top bit clear, it's a signed 32-bit number counting
   * from 1st Jan 1970.
   */
  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    let ts = buffer.readUInt32BE();
    if (ts === 0 || ts & (1 << 31)) {
      this.epochType = EpochType.PDB;
      this.value.setTime(PDB_EPOCH.getTime() + ts * 1000);
    } else {
      this.epochType = EpochType.UNIX;
      ts = buffer.readInt32BE();
      this.value.setTime(ts * 1000);
    }

    return 4;
  }

  serialize(opts?: SerializeOptions) {
    const buffer = Buffer.alloc(4);
    switch (this.epochType) {
      case EpochType.PDB:
        buffer.writeUInt32BE(
          (this.value.getTime() - PDB_EPOCH.getTime()) / 1000
        );
        break;
      case EpochType.UNIX:
        buffer.writeInt32BE(this.value.getTime() / 1000);
        break;
      default:
        throw new Error(`Unknown epoch type: ${this.epochType}`);
    }
    return buffer;
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 4;
  }
}

/** DatabaseTimestamp corresponding to epochDate. */
export const EPOCH_TIMESTAMP = DatabaseTimestamp.of(PDB_EPOCH);

/** A date (year, month, DOM) encoded as a 16-bit integer.
 *
 * There is no timezone information in the serialized form, so we assume UTC
 * when converting to / from JavaScript Date objects.
 */
export class DatabaseDate extends SerializableWrapper<Date> {
  /** Year. */
  year = PDB_EPOCH.getUTCFullYear();
  /** Month (Jan = 0, Dec = 11). */
  month = 0;
  /** Day of the month (1st = 1). */
  dayOfMonth = 1;

  get value() {
    return new Date(Date.UTC(this.year, this.month, this.dayOfMonth));
  }
  set value(newValue: Date) {
    this.year = newValue.getUTCFullYear();
    this.month = newValue.getUTCMonth();
    this.dayOfMonth = newValue.getUTCDate();
  }

  serialize(opts?: SerializeOptions) {
    if (this.year < PDB_EPOCH.getUTCFullYear()) {
      throw new Error(`Invalid year: ${this.year}`);
    }
    if (this.month < 0 || this.month > 11) {
      throw new Error(`Invalid month: ${this.month}`);
    }
    if (this.dayOfMonth < 1 || this.dayOfMonth > 31) {
      throw new Error(`Invalid day of month: ${this.dayOfMonth}`);
    }
    return SUInt16BE.of(
      ((this.year - PDB_EPOCH.getUTCFullYear()) << 9) |
        ((this.month + 1) << 5) |
        this.dayOfMonth
    ).serialize();
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const {value: v} = SUInt16BE.from(buffer, opts);

    // upper 7 bits => year since 1904
    this.year = ((v >> 9) & 0x7f) + PDB_EPOCH.getUTCFullYear();
    // 4 bits => month
    this.month = ((v >> 5) & 0x0f) - 1;
    // 5 bits => date
    this.dayOfMonth = v & 0x1f;

    return this.getSerializedLength(opts);
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }

  toJSON() {
    return this.value.toISOString();
  }
}

/** DatabaseDate wrapper where the value may be unspecified (indicated by 0xff). */
export class OptionalDatabaseDate extends SerializableWrapper<DatabaseDate | null> {
  /** DatabaseDate value, or null if unspecified.*/
  value: DatabaseDate | null = null;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const dateValue = buffer.readUInt16BE();
    this.value = dateValue === 0xffff ? null : DatabaseDate.from(buffer, opts);
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    return this.value ? this.value.serialize(opts) : Buffer.of(0xff, 0xff);
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}
