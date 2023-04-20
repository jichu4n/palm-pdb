import {
  DeserializeOptions,
  SBuffer,
  Serializable,
  SerializeOptions,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {
  DatabaseHdrType,
  PdbRecordListType,
  PrcRecordListType,
  RecordEntryType,
  RecordListType,
  RsrcEntryType,
} from './database-header';
import {PdbSBufferRecord, PrcSBufferRecord, Record} from './record';
import {DEFAULT_ENCODING} from './util';

/** Representation of a Palm OS database file. */
export abstract class Database<
  /** Record or resource entry type. */
  EntryT extends RecordEntryType | RsrcEntryType,
  /** Record type. */
  RecordT extends Record<EntryT>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Serializable {
  /** Record list constructor, to be provided by child classes. */
  protected abstract readonly recordListType: new () => RecordListType<EntryT>;
  /** Record type constructor, to be provided by child classes. */
  protected abstract readonly recordType: new () => RecordT;
  /** AppInfo type constructor, to be provided by child classes. */
  protected readonly appInfoType: (new () => AppInfoT) | null = null;
  /** SortInfo type constructor, to be provided by child classes. */
  protected readonly sortInfoType: (new () => SortInfoT) | null = null;

  /** Database header.
   *
   * Note that some fields in the header are recomputed based on other
   * properties during serialization. See `serialize()` for details.
   */
  header: DatabaseHdrType = this.defaultHeader;
  /** AppInfo value. */
  appInfo: AppInfoT | null = this.defaultAppInfo;
  /** SortInfo value. */
  sortInfo: SortInfoT | null = this.defaultSortInfo;
  /** Record values. */
  records: Array<RecordT> = [];

  /** Generates the default header for a new database. */
  get defaultHeader() {
    return new DatabaseHdrType();
  }
  /** Generates the default AppInfo for a new database. */
  get defaultAppInfo(): AppInfoT | null {
    return null;
  }
  /** Generates the default SortInfo for a new database. */
  get defaultSortInfo(): SortInfoT | null {
    return null;
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    opts = {encoding: DEFAULT_ENCODING, ...opts};
    this.header.deserialize(buffer, opts);
    const recordList = new this.recordListType();
    recordList.deserialize(
      buffer.slice(this.header.getSerializedLength(opts)),
      opts
    );

    if (this.appInfoType && this.header.appInfoId) {
      const appInfoEnd =
        this.header.sortInfoId ||
        (recordList.values.length > 0
          ? recordList.values[0].localChunkId
          : buffer.length);
      if (!this.appInfo) {
        this.appInfo = new this.appInfoType();
      }
      this.appInfo.deserialize(
        buffer.slice(this.header.appInfoId, appInfoEnd),
        opts
      );
    } else {
      this.appInfo = null;
    }

    if (this.sortInfoType && this.header.sortInfoId) {
      const sortInfoEnd =
        recordList.values.length > 0
          ? recordList.values[0].localChunkId
          : buffer.length;
      if (!this.sortInfo) {
        this.sortInfo = new this.sortInfoType();
      }
      this.sortInfo.deserialize(
        buffer.slice(this.header.sortInfoId, sortInfoEnd),
        opts
      );
    } else {
      this.sortInfo = null;
    }

    this.records = [];
    let lastRecordEnd = 0;
    for (let i = 0; i < recordList.values.length; ++i) {
      const recordStart = recordList.values[i].localChunkId;
      const recordEnd =
        i < recordList.values.length - 1
          ? recordList.values[i + 1].localChunkId
          : buffer.length;
      const record = new this.recordType();
      record.entry = recordList.values[i];
      record.deserialize(buffer.slice(recordStart, recordEnd), opts);
      this.records.push(record);
      lastRecordEnd = recordEnd;
    }

    return lastRecordEnd;
  }

  // Recomputed fields:
  //   - appInfoId
  //   - sortInfoId
  serialize(opts?: SerializeOptions) {
    opts = {encoding: DEFAULT_ENCODING, ...opts};
    const recordList = new this.recordListType();
    recordList.values = this.records.map(({entry}) => entry);

    let offset =
      this.header.getSerializedLength(opts) +
      recordList.getSerializedLength(opts);
    if (this.appInfo) {
      this.header.appInfoId = offset;
      offset += this.appInfo.getSerializedLength(opts);
    } else {
      this.header.appInfoId = 0;
    }
    if (this.sortInfo) {
      this.header.sortInfoId = offset;
      offset += this.sortInfo.getSerializedLength(opts);
    } else {
      this.header.sortInfoId = 0;
    }

    for (let i = 0; i < this.records.length; ++i) {
      recordList.values[i].localChunkId = offset;
      offset += this.records[i].getSerializedLength(opts);
    }

    const writer = new SmartBuffer();
    writer.writeBuffer(this.header.serialize(opts));
    writer.writeBuffer(recordList.serialize(opts));
    if (this.appInfo) {
      writer.writeBuffer(this.appInfo.serialize(opts));
    }
    if (this.sortInfo) {
      writer.writeBuffer(this.sortInfo.serialize(opts));
    }
    for (const record of this.records) {
      writer.writeBuffer(record.serialize(opts));
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.serialize(opts).length;
  }
}

/** PDB databases. */
export abstract class PdbDatabase<
  /** Record type. */
  RecordT extends Record<RecordEntryType>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<RecordEntryType, RecordT, AppInfoT, SortInfoT> {
  constructor() {
    super();
    this.header.attributes.resDB = false;
  }

  recordListType = PdbRecordListType;

  /** Constructs a PdbDatabase class with the given parameters. */
  static of<
    RecordT extends Record<RecordEntryType>,
    AppInfoT extends Serializable = SBuffer,
    SortInfoT extends Serializable = SBuffer
  >(
    recordType: new () => RecordT,
    appInfoType?: new () => AppInfoT,
    sortInfoType?: new () => SortInfoT
  ) {
    return class extends PdbDatabase<RecordT, AppInfoT, SortInfoT> {
      recordType = recordType;
      appInfoType = appInfoType ?? null;
      sortInfoType = sortInfoType ?? null;
      get defaultAppInfo() {
        return appInfoType ? new appInfoType() : null;
      }
      get defaultSortInfo() {
        return sortInfoType ? new sortInfoType() : null;
      }
    };
  }
}

/** PRC databases. */
export abstract class PrcDatabase<
  /** Record type. */
  RecordT extends Record<RsrcEntryType>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<RsrcEntryType, RecordT, AppInfoT, SortInfoT> {
  constructor() {
    super();
    this.header.attributes.resDB = true;
  }
  recordListType = PrcRecordListType;

  /** Constructs a PrcDatabase class with the given parameters. */
  static of<
    RecordT extends Record<RsrcEntryType>,
    AppInfoT extends Serializable = SBuffer,
    SortInfoT extends Serializable = SBuffer
  >(
    recordType: new () => RecordT,
    appInfoType?: new () => AppInfoT,
    sortInfoType?: new () => SortInfoT
  ) {
    return class extends PrcDatabase<RecordT, AppInfoT, SortInfoT> {
      recordType = recordType;
      appInfoType = appInfoType ?? null;
      sortInfoType = sortInfoType ?? null;
      get defaultAppInfo() {
        return appInfoType ? new appInfoType() : null;
      }
      get defaultSortInfo() {
        return sortInfoType ? new sortInfoType() : null;
      }
    };
  }
}

/** PDB database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPdbDatabase extends PdbDatabase.of(
  PdbSBufferRecord,
  SBuffer,
  SBuffer
) {}

/** PRC database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPrcDatabase extends PrcDatabase.of(
  PrcSBufferRecord,
  SBuffer,
  SBuffer
) {}
