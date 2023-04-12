import {SBuffer, Serializable, SObject} from 'serio';
import {RecordEntryType, RsrcEntryType} from './database-header';

/** Interface of database records. */
export interface Record<EntryT extends RecordEntryType | RsrcEntryType>
  extends Serializable {
  /** Record entry stored in the database header. */
  entry: EntryT;
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
export class PdbSBufferRecord
  extends SBuffer
  implements Record<RecordEntryType>
{
  entry = new RecordEntryType();
}

/** No-op PRC database record implementation that serializes record to / from Buffers. */
export class PrcSBufferRecord extends SBuffer implements Record<RsrcEntryType> {
  entry = new RsrcEntryType();
}
