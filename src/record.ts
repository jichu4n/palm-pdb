import {SBuffer, Serializable} from 'serio';
import {RecordEntryType, RsrcEntryType} from '.';

/** Interface of database records. */
export interface Record<MetadataT extends RecordEntryType | RsrcEntryType>
  extends Serializable {
  /** Metadata corresponding to this record. */
  metadata: MetadataT;
}

/** A record in a PDB database. */
export type PdbRecord = Record<RecordEntryType>;

/** A record in a PRC database. */
export type PrcRecord = Record<RsrcEntryType>;

/** No-op PDB database record implementation that serializes record to / from Buffers. */
export class PdbSBufferRecord
  extends SBuffer
  implements Record<RecordEntryType>
{
  metadata: RecordEntryType = new RecordEntryType();
}

/** No-op PRC database record implementation that serializes record to / from Buffers. */
export class PrcSBufferRecord extends SBuffer implements Record<RsrcEntryType> {
  metadata: RsrcEntryType = new RsrcEntryType();
}
