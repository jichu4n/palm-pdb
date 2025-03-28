import times from 'lodash/times';
import {
  bitfield,
  DeserializeOptions,
  field,
  json,
  SBitmask,
  SerializableWrapper,
  SerializeOptions,
  SObject,
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

  getSerializedLength(_opts?: SerializeOptions) {
    return 2;
  }
}

/** DatebookDB AppInfo block. */
export class DatebookAppInfo extends AppInfoType {
  /** Day of the week to start the week on. Not sure what the format is
   * ¯\_(ツ)_/¯ */
  @field(SUInt8)
  firstDayOfWeek = 0;

  @field(SUInt8)
  @json(false)
  private padding2 = 0;
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
  @json(false)
  private attrs = new DatebookRecordAttrs();

  @field(SUInt8)
  @json(false)
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
      this.recurrenceSettings = new RecurrenceSettings();
      offset += this.recurrenceSettings.deserialize(
        buffer.subarray(offset),
        opts
      );
    } else {
      this.recurrenceSettings = null;
    }

    if (this.attrs.hasExceptionDates) {
      const wrapper = new (SDynamicArray.of(SUInt16BE, DatabaseDate))();
      offset += wrapper.deserialize(buffer.subarray(offset), opts);
      this.exceptionDates = wrapper.value;
    } else {
      this.exceptionDates = [];
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

    return offset;
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
      pieces.push(this.recurrenceSettings.serialize(opts));
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
        ? this.recurrenceSettings.getSerializedLength(opts)
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
  @json(false)
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
  @json(false)
  private unused2 = 0;
}

/** Time unit for describing when the alarm should fire. */
export enum AlarmTimeUnit {
  MINUTES = 0,
  HOURS = 1,
  DAYS = 2,
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

  /** Time unit for expressing when the alarm should fire. */
  @field(SUInt8.enum(AlarmTimeUnit))
  unit = AlarmTimeUnit.MINUTES;
}

/** Frequency of a recurring event. */
export enum RecurrenceFrequency {
  /** Don't repeat. */
  NONE = 0,
  /** Repeat every N days */
  DAILY = 1,
  /** Repeat every N weeks on the same days of the week. */
  WEEKLY = 2,
  /** Repeat on same week of the month every N months. */
  MONTHLY_BY_DAY = 3,
  /** Repeat on same day of the month every N months. */
  MONTHLY_BY_DATE = 4,
  /** Repeat on same day of the year every N years. */
  YEARLY = 5,
}

/** Additional settings for events with weekly recurrence. */
export interface WeeklyRecurrenceSettings {
  /** Array of 7 booleans specifying which days of the week the event recurs on.
   *
   * Index 0 = Sunday, 1 = Monday, etc. For example, the following indicates an
   * event that recurs on Monday, Wednesday and Friday:
   *
   *   [false, true, false, true, false, true, false]
   */
  days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  /** Day of the week that weeks start on - 0 for Sunday, 1 for Monday.
   *
   * This affects events that repeat every 2nd Sunday (or higher interval).
   */
  firstDayOfWeek: number;
}

/** Additional settings for events with monthly-by-day recurrence frequency. */
export interface MonthlyByDayRecurrenceSettings {
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
  day: number;
}
/** Event recurrence settings. */
export class RecurrenceSettings extends SObject {
  /** Frequency of this recurring event. */
  @field(SUInt8.enum(RecurrenceFrequency))
  frequency = RecurrenceFrequency.DAILY;

  @field(SUInt8)
  @json(false)
  private padding1 = 0;

  /** Recurrence end date. If null, the event repeats forever. */
  @field(OptionalDatabaseDate)
  endDate: DatabaseDate | null = null;

  /** The interval at which the event repeats (every N days / weeks / months /
   * years). */
  @field(SUInt8)
  interval = 1;

  /** Additional settings for WEEKLY frequency.
   *
   * Required if frequency is WEEKLY.
   */
  weekly: WeeklyRecurrenceSettings | null = null;

  /** Additional settings for MONTHLY_BY_DAY frequency.
   *
   * Required if frequency is MONTHLY_BY_DAY.
   */
  monthlyByDay: MonthlyByDayRecurrenceSettings | null = null;

  @field(SUInt8)
  @json(false)
  private arg1 = 0;

  @field(SUInt8)
  @json(false)
  private arg2 = 0;

  @field(SUInt8)
  @json(false)
  private padding2 = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const offset = super.deserialize(buffer, opts);
    this.weekly = null;
    this.monthlyByDay = null;
    switch (this.frequency) {
      case RecurrenceFrequency.DAILY:
      case RecurrenceFrequency.MONTHLY_BY_DATE:
      case RecurrenceFrequency.YEARLY:
        break;
      case RecurrenceFrequency.WEEKLY: {
        const days = times(
          7,
          (i) => !!(this.arg1 & (1 << i))
        ) as WeeklyRecurrenceSettings['days'];
        const firstDayOfWeek = this.arg2;
        this.weekly = {days, firstDayOfWeek};
        break;
      }
      case RecurrenceFrequency.MONTHLY_BY_DAY: {
        const weekOfMonth = Math.floor(this.arg1 / 7);
        const day = this.arg1 % 7;
        this.monthlyByDay = {weekOfMonth, day};
        break;
      }
      default:
        throw new Error(`Invalid frequency type: ${this.frequency}`);
    }

    return offset;
  }

  serialize(opts?: SerializeOptions) {
    switch (this.frequency) {
      case RecurrenceFrequency.DAILY:
      case RecurrenceFrequency.MONTHLY_BY_DATE:
      case RecurrenceFrequency.YEARLY:
        this.arg1 = 0;
        this.arg2 = 0;
        break;
      case RecurrenceFrequency.WEEKLY: {
        if (!this.weekly) {
          throw new Error('`weekly` must be set when frequency is WEEKLY');
        }
        const {days, firstDayOfWeek} = this.weekly;
        if (days.length !== 7) {
          throw new Error(
            `Days array must have exactly 7 elements, found ${days.length}`
          );
        }
        this.arg1 = 0;
        for (let i = 0; i < 7; ++i) {
          if (days[i]) {
            this.arg1 |= 1 << i;
          }
        }
        if (firstDayOfWeek < 0 || firstDayOfWeek > 1) {
          throw new Error(`Invalid first day of week: ${firstDayOfWeek}`);
        }
        this.arg2 = firstDayOfWeek;
        break;
      }
      case RecurrenceFrequency.MONTHLY_BY_DAY: {
        if (!this.monthlyByDay) {
          throw new Error(
            '`monthlyByDay` must be set when frequency is MONTHLY_BY_DAY'
          );
        }
        const {weekOfMonth, day} = this.monthlyByDay;
        if (weekOfMonth < 0 || weekOfMonth > 5) {
          throw new Error(`Invalid week of month: ${weekOfMonth}`);
        }
        if (day < 0 || day > 7) {
          throw new Error(`Invalid day of week: ${day}`);
        }
        this.arg1 = weekOfMonth * 7 + day;
        this.arg2 = 0;
        break;
      }
      default:
        throw new Error(`Invalid frequency type: ${this.frequency}`);
    }
    return super.serialize(opts);
  }
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
  header = DatabaseHdrType.with({
    name: 'DatebookDB',
    type: 'DATA',
    creator: 'date',
  });
}
