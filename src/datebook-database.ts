import {
  bitfield,
  decodeString,
  DeserializeOptions,
  encodeString,
  field,
  SBitmask,
  Serializable,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {
  AppInfoType,
  DatabaseDate,
  DatabaseHdrType,
  OptionalDatabaseDate,
  PdbDatabase,
  PdbRecord,
} from '.';

/** DatebookDB AppInfo block. */
export class DatebookAppInfo extends SObject {
  /** Standard category info. */
  @field()
  categoryInfo = new AppInfoType();

  /** Day of the week to start the week on. Not sure what the format is
   * ¯\_(ツ)_/¯ */
  @field(SUInt8)
  startOfWeek = 0;

  @field(SUInt8)
  padding1 = 0;
}

/** A DatebookDB record. */
export class DatebookRecord extends PdbRecord {
  /** Date of the event. */
  date: DatabaseDate = new DatabaseDate();
  /** Start time of event. */
  startTime: OptionalEventTime = new OptionalEventTime();
  /** End time of event. */
  endTime: OptionalEventTime = new OptionalEventTime();
  /** Alarm settings, or null if no alarm configured. */
  alarmSettings: AlarmSettings | null = null;
  /** Recurrence settings, or null if the event is not recurring. */
  recurrenceSettings: RecurrenceSettings | null = null;
  /** Dates on which to skip repetitions. */
  exceptionDates: Array<DatabaseDate> = [];
  /** Main description. */
  description = '';
  /** Additional note. */
  note = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    this.startTime.deserialize(
      reader.readBuffer(this.startTime.getSerializedLength(opts)),
      opts
    );
    this.endTime.deserialize(
      reader.readBuffer(this.endTime.getSerializedLength(opts)),
      opts
    );
    this.date.deserialize(
      reader.readBuffer(this.date.getSerializedLength(opts)),
      opts
    );

    const attrs = new DatebookRecordAttrs();
    attrs.deserialize(reader.readBuffer(attrs.getSerializedLength(opts)), opts);
    reader.readUInt8(); // Padding byte

    if (attrs.hasAlarmSettings) {
      this.alarmSettings = AlarmSettingsWrapper.from(
        reader.readBuffer(new AlarmSettingsWrapper().getSerializedLength(opts)),
        opts
      ).value;
    } else {
      this.alarmSettings = null;
    }

    if (attrs.hasRecurrenceSettings) {
      this.recurrenceSettings = RecurrenceSettingsWrapper.from(
        reader.readBuffer(
          new RecurrenceSettingsWrapper().getSerializedLength(opts)
        ),
        opts
      ).value;
    } else {
      this.recurrenceSettings = null;
    }

    this.exceptionDates.length = 0;
    if (attrs.hasExceptionDates) {
      const numExceptions = reader.readUInt16BE();
      for (let i = 0; i < numExceptions; ++i) {
        const exceptionDate = new DatabaseDate();
        exceptionDate.deserialize(
          reader.readBuffer(exceptionDate.getSerializedLength(opts)),
          opts
        );
        this.exceptionDates.push(exceptionDate);
      }
    }

    this.description = attrs.hasDescription
      ? decodeString(reader.readBufferNT(), opts)
      : '';
    this.note = attrs.hasNote ? decodeString(reader.readBufferNT(), opts) : '';

    return buffer.length;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    writer.writeBuffer(this.startTime.serialize(opts));
    writer.writeBuffer(this.endTime.serialize(opts));
    writer.writeBuffer(this.date.serialize(opts));

    const attrs = new DatebookRecordAttrs();
    attrs.hasAlarmSettings = !!this.alarmSettings;
    attrs.hasRecurrenceSettings = !!this.recurrenceSettings;
    attrs.hasExceptionDates = this.exceptionDates.length > 0;
    attrs.hasDescription = !!this.description;
    attrs.hasNote = !!this.note;
    writer.writeBuffer(attrs.serialize(opts));
    writer.writeUInt8(0); // Padding byte

    if (this.alarmSettings) {
      writer.writeBuffer(
        AlarmSettingsWrapper.of(this.alarmSettings).serialize(opts)
      );
    }

    if (this.recurrenceSettings) {
      writer.writeBuffer(
        RecurrenceSettingsWrapper.of(this.recurrenceSettings).serialize(opts)
      );
    }

    if (this.exceptionDates.length > 0) {
      writer.writeUInt16BE(this.exceptionDates.length);
      for (const exceptionDate of this.exceptionDates) {
        writer.writeBuffer(exceptionDate.serialize(opts));
      }
    }

    if (this.description) {
      writer.writeBufferNT(encodeString(this.description, opts));
    }
    if (this.note) {
      writer.writeBufferNT(encodeString(this.note, opts));
    }

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return (
      8 +
      (this.alarmSettings
        ? AlarmSettingsWrapper.of(this.alarmSettings).getSerializedLength(opts)
        : 0) +
      (this.recurrenceSettings
        ? RecurrenceSettingsWrapper.of(
            this.recurrenceSettings
          ).getSerializedLength(opts)
        : 0) +
      (this.exceptionDates.length > 0
        ? 2 +
          this.exceptionDates.length *
            this.exceptionDates[0].getSerializedLength(opts)
        : 0) +
      (this.note ? this.note.length + 1 : 0) +
      (this.description ? this.description.length + 1 : 0)
    );
  }
}

/** Datebook record attribute flags. */
export class DatebookRecordAttrs extends SBitmask.of(SUInt8) {
  @bitfield(1)
  private unused1 = 0;
  /** Whether this event should sound an alarm before the start time. */
  @bitfield(1)
  hasAlarmSettings = false;
  /** Whether this event is recurring. */
  @bitfield(1)
  hasRecurrenceSettings = false;
  /** Whether this event has an additional note. */
  @bitfield(1)
  hasNote = false;
  /** Whether this event has repetition exceptions. */
  @bitfield(1)
  hasExceptionDates = false;
  /** Whether this event has a description. */
  @bitfield(1)
  hasDescription = false;
  @bitfield(2)
  private unused2 = 0;
}

/** Event start / end time. */
export class OptionalEventTime extends Serializable {
  /** Time value, or null if not specified. */
  value: {
    /** Hour of day (0 to 23). */
    hour: number;
    /** Minute (0-59). */
    minute: number;
  } | null = null;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    if (buffer.readUInt16BE() === 0xffff) {
      this.value = null;
    } else {
      const reader = SmartBuffer.fromBuffer(buffer);
      this.value = {
        hour: reader.readUInt8(),
        minute: reader.readUInt8(),
      };
    }
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    if (this.value) {
      const {hour, minute} = this.value;
      if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour value: ${hour}`);
      }
      writer.writeUInt8(hour);
      if (minute < 0 || minute > 59) {
        throw new Error(`Invalid minute value: ${minute}`);
      }
      writer.writeUInt8(minute);
    } else {
      writer.writeUInt16BE(0xffff);
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}

/** Time unit for describing when the alarm should fire. */
export enum AlarmTimeUnit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
}

/** Event alarm settings.
 *
 * The time when the alarm will fire is specified by the combination of `unit`
 * and `value`. For example, `{unit: 'minutes', value: 10}` means the alarm will
 * fire 10 minutes before the event.
 */
export interface AlarmSettings {
  /** Time unit for expressing when the alarm should fire. */
  unit: AlarmTimeUnit;
  /** Number of time units before the event start time to fire the alarm. */
  value: number;
}

/** SerializableWrapper for AlarmSettings. */
export class AlarmSettingsWrapper extends SerializableWrapper<AlarmSettings> {
  value = {unit: AlarmTimeUnit.MINUTES, value: 0};

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.value.value = reader.readUInt8();
    this.value.unit = AlarmSettingsWrapper.unitValues[reader.readUInt8()];
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    if (this.value.value < 0 || this.value.value > 0xff) {
      throw new Error(`Invalid hour value: ${this.value.value}`);
    }
    writer.writeUInt8(this.value.value);
    const unitValueIndex = AlarmSettingsWrapper.unitValues.indexOf(
      this.value.unit
    );
    if (unitValueIndex < 0) {
      throw new Error(`Unknown alarm time unit: ${this.value.unit}`);
    }
    writer.writeUInt8(unitValueIndex);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }

  /** Array of unit values, indexed by their numeric value when serialized. */
  static readonly unitValues: Array<AlarmTimeUnit> = [
    AlarmTimeUnit.MINUTES,
    AlarmTimeUnit.HOURS,
    AlarmTimeUnit.DAYS,
  ];
}

/** Frequency of a recurring event. */
export enum RecurrenceFrequency {
  /** Don't repeat. */
  NONE = 'none',
  /** Repeat every N days */
  DAILY = 'daily',
  /** Repeat every N weeks on the same days of the week. */
  WEEKLY = 'weekly',
  /** Repeat on same week of the month every N months. */
  MONTHLY_BY_DAY = 'monthlyByDay',
  /** Repeat on same day of the month every N months. */
  MONTHLY_BY_DATE = 'monthlyByDate',
  /** Repeat on same day of the year every N years. */
  YEARLY = 'yearly',
}

/** Event recurrence settings. */
export type RecurrenceSettings = (
  | {
      /** Don't repeat. */
      frequency: RecurrenceFrequency.NONE;
    }
  | {
      /** Repeat every N days */
      frequency: RecurrenceFrequency.DAILY;
    }
  | {
      /** Repeat every N weeks on the same days of the week. */
      frequency: RecurrenceFrequency.WEEKLY;
      /** Array specifying which days of the week to repeat on.
       *
       * Index 0 = Sunday, 1 = Monday, etc.
       */
      daysOfWeek: Array<boolean>;
      /** Day the week starts on (0 for Sunday, 1 for Monday).
       *
       * This affects the phase of events that repeat every 2nd (or more) Sunday.
       */
      startOfWeek: number;
    }
  | {
      /** Repeat on same week of the month every N months. */
      frequency: RecurrenceFrequency.MONTHLY_BY_DAY;
      /** Week number within the month.
       *
       * 0 = 1st week of the month
       * 1 = 2nd week of the month
       * ...
       * 5 = last week of the month
       */
      weekOfMonth: number;
      /** Day of week.
       *
       * 0 = Sunday, 1 = Monday, etc.
       */
      dayOfWeek: number;
    }
  | {
      /** Repeat on same day of the month every N months. */
      frequency: RecurrenceFrequency.MONTHLY_BY_DATE;
    }
  | {
      /** Repeat on same day of the year every N years. */
      frequency: RecurrenceFrequency.YEARLY;
    }
) & {
  /** Frequency of repetition (every N days / weeks / months / years). */
  interval: number;
  /** Repetition end date. */
  endDate: OptionalDatabaseDate;
};

/** SerializableWrapper for RecurrenceSettings. */
class RecurrenceSettingsWrapper extends SerializableWrapper<RecurrenceSettings> {
  /** How the event should repeat. */
  value: RecurrenceSettings = {
    frequency: RecurrenceFrequency.DAILY,
    interval: 1,
    endDate: new OptionalDatabaseDate(),
  };

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    const rawType = reader.readUInt8();
    const frequency =
      RecurrenceSettingsWrapper.recurringFrequencyValues[rawType];
    reader.readUInt8(); // Padding byte

    const endDate = OptionalDatabaseDate.from(
      reader.readBuffer(this.value.endDate.getSerializedLength(opts)),
      opts
    );

    const interval = reader.readUInt8();

    switch (frequency) {
      case RecurrenceFrequency.DAILY:
      case RecurrenceFrequency.MONTHLY_BY_DATE:
      case RecurrenceFrequency.YEARLY:
        this.value = {frequency, endDate, interval};
        break;
      case RecurrenceFrequency.WEEKLY:
        const rawDaysOfWeek = reader.readUInt8();
        const daysOfWeek: Array<boolean> = [];
        for (let i = 0; i < 7; ++i) {
          daysOfWeek.push(!!(rawDaysOfWeek & (1 << i)));
        }
        const startOfWeek = reader.readUInt8();
        this.value = {frequency, interval, endDate, daysOfWeek, startOfWeek};
        break;
      case RecurrenceFrequency.MONTHLY_BY_DAY:
        const rawDayOfMonth = reader.readUInt8();
        const weekOfMonth = Math.floor(rawDayOfMonth / 7);
        const dayOfWeek = rawDayOfMonth % 7;
        this.value = {frequency, interval, endDate, weekOfMonth, dayOfWeek};
        break;
      default:
        throw new Error(`Invalid recurring frequency type: ${frequency}`);
    }

    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    const frequencyValueIndex =
      RecurrenceSettingsWrapper.recurringFrequencyValues.indexOf(
        this.value.frequency
      );
    if (frequencyValueIndex < 0) {
      throw new Error(
        `Invalid recurring frequency type: ${this.value.frequency}`
      );
    }
    writer.writeUInt8(frequencyValueIndex);
    writer.writeUInt8(0); // Padding byte

    writer.writeBuffer(this.value.endDate.serialize(opts));

    if (this.value.interval < 0 || this.value.interval > 0xff) {
      throw new Error(
        'Invalid interval: expected number between 0 and 255, ' +
          `found ${this.value.interval}`
      );
    }
    writer.writeUInt8(this.value.interval);

    switch (this.value.frequency) {
      case RecurrenceFrequency.DAILY:
      case RecurrenceFrequency.MONTHLY_BY_DATE:
      case RecurrenceFrequency.YEARLY:
        writer.writeUInt16BE(0);
        break;
      case RecurrenceFrequency.WEEKLY:
        const {daysOfWeek, startOfWeek} = this.value;
        if (daysOfWeek.length !== 7) {
          throw new Error(
            'Days of week array must have exactly 7 elements ' +
              `(found ${daysOfWeek.length})`
          );
        }
        let rawDaysOfWeek = 0;
        for (let i = 0; i < 7; ++i) {
          if (daysOfWeek[i]) {
            rawDaysOfWeek |= 1 << i;
          }
        }
        writer.writeUInt8(rawDaysOfWeek);
        if (startOfWeek < 0 || startOfWeek > 1) {
          throw new Error(`Invalid start of week: ${startOfWeek}`);
        }
        writer.writeUInt8(startOfWeek);
        break;
      case RecurrenceFrequency.MONTHLY_BY_DAY:
        const {weekOfMonth, dayOfWeek} = this.value;
        if (weekOfMonth < 0 || weekOfMonth > 5) {
          throw new Error(`Invalid week of month: ${weekOfMonth}`);
        }
        if (dayOfWeek < 0 || dayOfWeek > 7) {
          throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }
        const rawDayOfMonth = weekOfMonth * 7 + dayOfWeek;
        writer.writeUInt8(rawDayOfMonth);
        writer.writeUInt8(0);
        break;
      default:
        throw new Error(
          `Invalid recurring frequency type: ${this.value.frequency}`
        );
    }
    writer.writeUInt8(0); // Padding byte

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 8;
  }

  /** Array of repetition frequency values, indexed by their numeric value when serialized. */
  static readonly recurringFrequencyValues: Array<RecurrenceFrequency> = [
    RecurrenceFrequency.NONE,
    RecurrenceFrequency.DAILY,
    RecurrenceFrequency.WEEKLY,
    RecurrenceFrequency.MONTHLY_BY_DAY,
    RecurrenceFrequency.MONTHLY_BY_DATE,
    RecurrenceFrequency.YEARLY,
  ];
}

/** DatebookDB database.
 *
 * References:
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/datebook.c
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Datebook.pm
 */
export class DatebookDatabase extends PdbDatabase.of(
  DatebookRecord,
  DatebookAppInfo
) {
  get defaultHeader() {
    return DatabaseHdrType.with({
      name: 'DatebookDB',
      type: 'DATA',
      creator: 'date',
    });
  }
}
