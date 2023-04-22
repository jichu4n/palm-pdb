import {field, SBuffer, Serializable, SObject} from 'serio';
import {EntryType, RecordEntryType, RsrcEntryType} from './database-header';

/** Interface of database records. */
export abstract class Record<EntryT extends EntryType> extends Serializable {
  /** Record entry stored in the database header. */
  abstract entry: EntryT;
}

/** A record in a PDB database. */
export abstract class PdbRecord
  extends SObject
  implements Record<RecordEntryType>
{
  entry = new RecordEntryType();
}

/** A record in a PRC database. */
export abstract class PrcRecord
  extends SObject
  implements Record<RsrcEntryType>
{
  entry = new RsrcEntryType();
}

/** No-op PDB database record implementation that serializes record to / from Buffers. */
export class RawPdbRecord extends PdbRecord {
  @field(SBuffer)
  data = Buffer.of();
}

/** No-op PRC database record implementation that serializes record to / from Buffers. */
export class RawPrcRecord extends PrcRecord {
  @field(SBuffer)
  data = Buffer.of();
}
