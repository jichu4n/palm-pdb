import {field, SBuffer, Serializable, SObject} from 'serio';
import {EntryType, RecordEntryType, RsrcEntryType} from './database-header';

/** Base class of records in a PDB or PRC database. */
export abstract class Record<EntryT extends EntryType> extends Serializable {
  /** Record entry stored in the database header. */
  abstract entry: EntryT;
}

/** Base class of records in a PDB database. */
export abstract class PdbRecord
  extends SObject
  implements Record<RecordEntryType>
{
  entry = new RecordEntryType();

  toJSON() {
    return {
      entry: this.entry,
      ...super.toJSON(),
    };
  }
}

/** Base class of records in a PRC database. */
export abstract class PrcRecord
  extends SObject
  implements Record<RsrcEntryType>
{
  entry = new RsrcEntryType();

  toJSON() {
    return {
      entry: this.entry,
      ...super.toJSON(),
    };
  }
}

/** PDB database record that simply stores record data in a Buffer. */
export class RawPdbRecord extends PdbRecord {
  @field(SBuffer)
  data: Buffer = Buffer.of();
}

/** PRC database record that simply stores record data in a Buffer. */
export class RawPrcRecord extends PrcRecord {
  @field(SBuffer)
  data: Buffer = Buffer.of();
}
