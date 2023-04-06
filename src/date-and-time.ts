import {
  DeserializeOptions,
  SObject,
  SUInt16BE,
  SerializableWrapper,
  SerializeOptions,
  field,
} from 'serio';

/** Epoch for PDB timestamps. */
export const epochTimestamp = new Date('1904-01-01T00:00:00.000Z');

/** Wrapper around a `Date` value with PDB-specific attributes. */
export class DatabaseTimestamp extends SerializableWrapper<Date> {
  /** JavaScript Date value corresponding to the time. */
  value: Date = new Date();
  /** The epoch to use when serializing this date. */
  epochType: 'pdb' | 'unix' = 'pdb';

  /** Parses a PDB timestamp.
   *
   * From https://wiki.mobileread.com/wiki/PDB#PDB_Times:
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
      this.epochType = 'pdb';
      this.value.setTime(epochTimestamp.getTime() + ts * 1000);
    } else {
      this.epochType = 'unix';
      ts = buffer.readInt32BE();
      this.value.setTime(ts * 1000);
    }

    return 4;
  }

  serialize(opts?: SerializeOptions) {
    const buffer = Buffer.alloc(4);
    switch (this.epochType) {
      case 'pdb':
        buffer.writeUInt32BE(
          (this.value.getTime() - epochTimestamp.getTime()) / 1000
        );
        break;
      case 'unix':
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
export const epochDatabaseTimestamp = new DatabaseTimestamp();
epochDatabaseTimestamp.value.setTime(epochTimestamp.getTime());

/** A date (year, month, DOM) encoded as a 16-bit integer. */
export class DatabaseDate extends SObject {
  /** Year. */
  year: number = epochTimestamp.getUTCFullYear();
  /** Month (Jan = 1, Dec = 12). */
  month: number = 1;
  /** Day of the month (1st = 1). */
  dayOfMonth: number = 1;

  @field(SUInt16BE)
  get value() {
    if (this.year < epochTimestamp.getUTCFullYear()) {
      throw new Error(`Invalid year: ${this.year}`);
    }
    if (this.month < 1 || this.month > 12) {
      throw new Error(`Invalid month: ${this.month}`);
    }
    if (this.dayOfMonth < 1 || this.dayOfMonth > 31) {
      throw new Error(`Invalid day of month: ${this.dayOfMonth}`);
    }
    return (
      ((this.year - epochTimestamp.getUTCFullYear()) << 9) |
      (this.month << 5) |
      this.dayOfMonth
    );
  }
  set value(newValue: number) {
    // upper 7 bits => year since 1904
    this.year = ((newValue >> 9) & 0x7f) + epochTimestamp.getUTCFullYear();
    // 4 bits => month
    this.month = (newValue >> 5) & 0x0f;
    // 5 bits => date
    this.dayOfMonth = newValue & 0x1f;
  }

  toJSON() {
    return new Date(this.year, this.month - 1, this.dayOfMonth)
      .toISOString()
      .split('T')[0];
  }
}

/** DatabaseDate wrapper where the value may be unspecified (indicated by 0xff). */
export class OptionalDatabaseDate extends SerializableWrapper<DatabaseDate | null> {
  /** DatabaseDate value, or null if unspecified.*/
  value: DatabaseDate | null = null;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const dateValue = buffer.readUInt16BE();
    if (dateValue === 0xffff) {
      this.value = null;
    } else {
      this.value = DatabaseDate.from(buffer, opts);
    }
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    if (this.value) {
      return this.value.serialize(opts);
    } else {
      const buffer = Buffer.alloc(this.getSerializedLength(opts));
      buffer.writeUInt16BE(0xffff);
      return buffer;
    }
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}
