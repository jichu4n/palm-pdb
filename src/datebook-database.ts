import {
  bitfield,
  DeserializeOptions,
  field,
  SBitmask,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SStringNT,
  SUInt16BE,
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
  SDynamicArray,
} from '.';

/** Event start / end time. */
export class EventTime extends SObject {
  /** Hour of day (0 to 23). */
  @field(SUInt8)
  hour = 0;
  /** Minute (0-59). */
  @field(SUInt8)
  minute = 0;

  serialize(opts?: SerializeOptions) {
    if (this.hour < 0 || this.hour > 23) {
      throw new Error(`Invalid hour value: ${this.hour}`);
    }
    if (this.minute < 0 || this.minute > 59) {
      throw new Error(`Invalid minute value: ${this.minute}`);
    }
    return super.serialize(opts);
  }
}

/** Event start / end time. */
export class OptionalEventTime extends SerializableWrapper<EventTime | null> {
  /** Time value, or null if not specified. */
  value: EventTime | null = null;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    this.value =
      buffer.readUInt16BE() === 0xffff ? null : EventTime.from(buffer, opts);
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    return this.value ? this.value.serialize(opts) : Buffer.of(0xff, 0xff);
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}

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
  private padding1 = 0;
}

/** A DatebookDB record. */
export class DatebookRecord extends PdbRecord {
  /** Start time of event. */
  @field(OptionalEventTime)
  startTime: EventTime | null = null;
  /** End time of event. */
  @field(OptionalEventTime)
  endTime: EventTime | null = null;
  /** Date of the event. */
  @field()
  date = new DatabaseDate();
  /** Attributes field. */
  @field()
  private attrs = new DatebookRecordAttrs();
  @field(SUInt8)
  private padding1 = 0;

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
    let offset = super.deserialize(buffer, opts);

    if (this.attrs.hasAlarmSettings) {
      this.alarmSettings = new AlarmSettings();
      offset += this.alarmSettings.deserialize(buffer.subarray(offset), opts);
    } else {
      this.alarmSettings = null;
    }

    if (this.attrs.hasRecurrenceSettings) {
      const wrapper = new RecurrenceSettingsWrapper();
      offset += wrapper.deserialize(buffer.subarray(offset), opts);
      this.recurrenceSettings = wrapper.value;
    } else {
      this.recurrenceSettings = null;
    }

    if (this.attrs.hasExceptionDates) {
      const wrapper = new (SDynamicArray.of(SUInt16BE, DatabaseDate))();
      offset += wrapper.deserialize(buffer.subarray(offset), opts);
      this.exceptionDates.splice(
        0,
        this.exceptionDates.length,
        ...wrapper.value
      );
    } else {
      this.exceptionDates.length = 0;
    }

    if (this.attrs.hasDescription) {
      const wrapper = new SStringNT();
      offset += wrapper.deserialize(buffer.subarray(offset), opts);
      this.description = wrapper.value;
    } else {
      this.description = '';
    }

    if (this.attrs.hasNote) {
      const wrapper = new SStringNT();
      offset += wrapper.deserialize(buffer.subarray(offset), opts);
      this.note = wrapper.value;
    } else {
      this.note = '';
    }

    return buffer.length;
  }

  serialize(opts?: SerializeOptions) {
    const pieces: Array<Buffer> = [];

    this.attrs.hasAlarmSettings = !!this.alarmSettings;
    this.attrs.hasRecurrenceSettings = !!this.recurrenceSettings;
    this.attrs.hasExceptionDates = this.exceptionDates.length > 0;
    this.attrs.hasDescription = !!this.description;
    this.attrs.hasNote = !!this.note;
    pieces.push(super.serialize(opts));

    if (this.alarmSettings) {
      pieces.push(this.alarmSettings.serialize(opts));
    }
    if (this.recurrenceSettings) {
      pieces.push(
        RecurrenceSettingsWrapper.of(this.recurrenceSettings).serialize(opts)
      );
    }
    if (this.exceptionDates.length > 0) {
      pieces.push(
        SDynamicArray.of(SUInt16BE, DatabaseDate)
          .of(this.exceptionDates)
          .serialize(opts)
      );
    }
    if (this.description) {
      pieces.push(SStringNT.of(this.description).serialize(opts));
    }
    if (this.note) {
      pieces.push(SStringNT.of(this.note).serialize(opts));
    }

    return Buffer.concat(pieces);
  }

  getSerializedLength(opts?: SerializeOptions) {
    return (
      8 +
      (this.alarmSettings ? this.alarmSettings.getSerializedLength(opts) : 0) +
      (this.recurrenceSettings
        ? RecurrenceSettingsWrapper.of(
            this.recurrenceSettings
          ).getSerializedLength(opts)
        : 0) +
      (this.exceptionDates.length > 0
        ? SDynamicArray.of(SUInt16BE, DatabaseDate)
            .of(this.exceptionDates)
            .getSerializedLength(opts)
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
export class AlarmSettings extends SObject {
  /** Number of time units before the event start time to fire the alarm. */
  @field(SUInt8)
  value = 0;
  @field(SUInt8)
  private unitValue = 0;
  /** Time unit for expressing when the alarm should fire. */
  unit = AlarmTimeUnit.MINUTES;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const offset = super.deserialize(buffer, opts);
    this.unit = AlarmSettings.unitValues[this.unitValue];
    return offset;
  }

  serialize(opts?: SerializeOptions) {
    if (this.value < 0 || this.value > 0xff) {
      throw new Error(`Invalid hour value: ${this.value}`);
    }
    this.unitValue = AlarmSettings.unitValues.indexOf(this.unit);
    if (this.unitValue < 0) {
      throw new Error(`Unknown alarm time unit: ${this.unit}`);
    }
    return super.serialize(opts);
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
  endDate: DatabaseDate | null;
};

/** SerializableWrapper for RecurrenceSettings. */
class RecurrenceSettingsWrapper extends SerializableWrapper<RecurrenceSettings> {
  /** How the event should repeat. */
  value: RecurrenceSettings = {
    frequency: RecurrenceFrequency.DAILY,
    interval: 1,
    endDate: null,
  };

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    const rawType = reader.readUInt8();
    const frequency =
      RecurrenceSettingsWrapper.recurringFrequencyValues[rawType];
    reader.readUInt8(); // Padding byte

    const endDate = OptionalDatabaseDate.from(
      reader.readBuffer(new OptionalDatabaseDate().getSerializedLength(opts)),
      opts
    ).value;

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

    writer.writeBuffer(
      OptionalDatabaseDate.of(this.value.endDate).serialize(opts)
    );

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
