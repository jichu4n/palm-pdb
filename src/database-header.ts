import {
  bitfield,
  field,
  json,
  SBitmask,
  Serializable,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {DatabaseTimestamp, PDB_EPOCH} from './date-time';
import {LocalId, RecordId, SDynamicArray, TypeId} from './util';

/** Maximum length of database names - 31 chars + 1 NUL byte.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataMgr.h#L72
 */
export const DB_NAME_LENGTH = 32;

/** Database header.
 *
 * References:
 *   - https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataPrv.h#L67
 */
export class DatabaseHdrType extends SObject {
  /** Database name. */
  @field(SStringNT.ofLength(DB_NAME_LENGTH))
  name = '';

  /** Database attribute flags. */
  @field()
  attributes: DatabaseAttrs = new DatabaseAttrs();

  /** Database version (integer). */
  @field(SUInt16BE)
  version = 0;

  /** Database creation timestamp. */
  @field()
  creationDate = new DatabaseTimestamp();

  /** Database modification timestamp. */
  @field()
  modificationDate = new DatabaseTimestamp();

  /** Last backup timestamp. */
  @field()
  lastBackupDate = DatabaseTimestamp.of(new Date(PDB_EPOCH));

  /** Modification number (integer). */
  @field(SUInt32BE)
  modificationNumber = 0;

  /** Offset to AppInfo block. */
  @field(LocalId)
  appInfoId = 0;

  /** Offset to SortInfo block. */
  @field(LocalId)
  sortInfoId = 0;

  /** Database type identifier (max 4 bytes). */
  @field(TypeId)
  type = '';

  /** Database creator identifier (max 4 bytes). */
  @field(TypeId)
  creator = '';

  /** Seed for generating record IDs. */
  @field(SUInt32BE)
  uniqueIdSeed = 0;
}

/** Record entry in PDB files.
 *
 * References:
 *   - https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataPrv.h#L23
 */
export class RecordEntryType extends SObject {
  /** Offset to raw record data. */
  @field(LocalId)
  localChunkId = 0;

  /** Record attributes. */
  @field()
  attributes = new RecordAttrs();

  /** Unique ID of the record.
   *
   * Valid records should have a non-zero unique ID.
   */
  @field(RecordId)
  uniqueId = 0;
}

/** Resource entry in PRC files.
 *
 * References:
 *   - https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataPrv.h#L36
 */
export class RsrcEntryType extends SObject {
  /** Resource type identifier (max 4 bytes). */
  @field(TypeId)
  type = '';

  /** Resource ID. */
  @field(SUInt16BE)
  resourceId = 0;

  /** Offset to raw record data. */
  @field(LocalId)
  localChunkId = 0;
}

/** Union type representing any record entry type. */
export type EntryType = RecordEntryType | RsrcEntryType;

/** Record or resource entry list. */
export interface RecordListType<EntryT extends EntryType> extends Serializable {
  /** Array of record or resource entries. */
  values: Array<EntryT>;
}

/** Record entry list in PDB databases.
 *
 * References:
 *   - https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataPrv.h#L51
 */
export class PdbRecordListType
  extends SObject
  implements RecordListType<RecordEntryType>
{
  /** Offset of next PdbRecordListType structure.
   *
   * We don't support multiple RecordListTypes, so this must always be 0. See
   * page 17 of the Palm File Format Specification for more details.
   */
  @field(SUInt32BE)
  @json(false)
  private readonly nextListId = 0;

  /** Array of record entries. */
  @field(SDynamicArray.of(SUInt16BE, RecordEntryType))
  values: Array<RecordEntryType> = [];

  @field(SUInt16BE)
  @json(false)
  private readonly padding1 = 0;
}

/** Resource entry list in PRC databases.
 *
 * References:
 *   - https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-3.1/include/Core/System/DataPrv.h#L51
 */
export class PrcRecordListType
  extends SObject
  implements RecordListType<RsrcEntryType>
{
  /** Offset of next PrcRecordListType structure.
   *
   * We don't support multiple RecordListTypes, so this must always be 0. See
   * page 17 of the Palm File Format Specification for more details.
   */
  @field(SUInt32BE)
  @json(false)
  private readonly nextListId = 0;

  /** Array of resource entries. */
  @field(SDynamicArray.of(SUInt16BE, RsrcEntryType))
  values: Array<RsrcEntryType> = [];

  @field(SUInt16BE)
  @json(false)
  private readonly padding1 = 0;
}

/** Database attribute flags.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 *   - https://github.com/madsen/Palm-PDB/blob/master/lib/Palm/PDB.pm
 */
export class DatabaseAttrs extends SBitmask.of(SUInt16BE) {
  /** Database not closed properly. */
  @bitfield(1)
  open = false;

  @bitfield(3)
  @json(false)
  private unused1 = 0;

  /** This database (resource or record) is associated with the application
   * with the same creator. It will be beamed and copied along with the
   * application. */
  @bitfield(1)
  bundle = false;

  /** This database (resource or record) is recyclable: it will be deleted Real
   * Soon Now, generally the next time the database is closed. */
  @bitfield(1)
  recyclable = false;

  /** This data database (not applicable for executables) can be "launched" by
   * passing its name to it's owner app ('appl' database with same creator)
   * using the sysAppLaunchCmdOpenNamedDB action code. */
  @bitfield(1)
  launchableData = false;

  /** This database should generally be hidden from view.
   *
   * Used to hide some apps from the main view of the launcher for example. For
   * data (non-resource) databases, this hides the record count within the
   * launcher info screen. */
  @bitfield(1)
  hidden = false;

  /** This database is used for file stream implementation. */
  @bitfield(1)
  stream = false;

  /** This database should not be copied to */
  @bitfield(1)
  copyPrevention = false;

  /** Device requires a reset after this database is installed. */
  @bitfield(1)
  resetAfterInstall = false;

  /** This tells the backup conduit that it's OK for it to install a newer version
   * of this database with a different name if the current database is open. This
   * mechanism is used to update the Graffiti Shortcuts database, for example.
   */
  @bitfield(1)
  okToInstallNewer = false;

  /** Set if database should be backed up to PC if no app-specific synchronization
   * conduit has been supplied. */
  @bitfield(1)
  backup = false;

  /** Set if Application Info block is dirty.
   *
   * Optionally supported by an App's conduit. */
  @bitfield(1)
  appInfoDirty = false;

  /** Read Only database. */
  @bitfield(1)
  readOnly = false;

  /** Whether this is a resource database (i.e. PRC). */
  @bitfield(1)
  resDB = false;
}

/** Record attribute flags in PDB files.
 *
 * In the DLP protocol, we use one byte to store record attribute flags and
 * another byte to store the record category. However, in PDB files, we use a
 * single byte is used to store both attribute flags and the record category.
 *
 * This presents a problem: there are 5 record attributes (namely delete, dirty,
 * busy, secret, and archive), leaving 3 bits unused, but we need 4 bits to
 * store the record category. So the lowest 4 bits are overloaded, but the
 * exactly how differs among existing open source implementations:
 *
 * In pilot-link:
 *   - Upper 4 bits store the first 4 record attributes (delete, dirty, busy, secret)
 *   - Lower 4 bits store the record category; there's no archive bit
 *
 * In ColdSync:
 *   - If the record is busy, bit 5 stores the archive flag and the lowest 3
 *     bits are unused.
 *   - If the record is not busy, the lowest 4 bits store the category.
 *
 * In the Palm::PDB Perl module:
 *   - If the record is deleted or busy, bit 5 stores the archive flag and the
 *     lowest 3 bits are unused.
 *   - If the record is neither deleted or busy, the lowest 4 bits store the
 *     category.
 *
 * Here we've chosen to follow the Palm::PDB Perl module's implementation, as it
 * is the most flexible.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h#L44
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DLCommon.h#L44
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L670
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L479
 *   - https://github.com/dwery/coldsync/blob/master/libpdb/pdb.c#L96
 *   - https://metacpan.org/dist/Palm-PDB/source/lib/Palm/PDB.pm#L428
 */
export class RecordAttrs extends SBitmask.of(SUInt8) {
  /** Record has been deleted. */
  @bitfield(1)
  delete = false;

  /** Record has been modified. */
  @bitfield(1)
  dirty = false;

  /** Record currently in use.
   *
   * This bit may also indicate the record has been deleted -- see comments in
   * https://github.com/dwery/coldsync/blob/master/include/pdb.h .
   */
  @bitfield(1)
  busy = false;

  /** "Secret" record - password protected. */
  @bitfield(1)
  secret = false;

  @bitfield(4)
  @json(false)
  private lowest4bits = 0;

  /** Record is archived.
   *
   * Only available if deleted or busy.
   */
  @json(true)
  get archive() {
    if (this.delete || this.busy) {
      return Boolean(this.lowest4bits & 0b1000);
    } else {
      return false;
    }
  }
  set archive(newValue: boolean) {
    if (!(this.delete || this.busy)) {
      throw new Error(
        `Attempting to set archive = ${newValue} ` +
          `on record that is neither deleted nor busy`
      );
    }
    this.lowest4bits = newValue
      ? this.lowest4bits | 0b1000
      : this.lowest4bits & 0b0111;
  }

  /** Record category.
   *
   * Only available if NOT deleted or busy.
   */
  @json(true)
  get category() {
    if (this.delete || this.busy) {
      return 0;
    } else {
      return this.lowest4bits;
    }
  }
  set category(newValue: number) {
    if (this.delete || this.busy) {
      const recordState =
        this.delete && this.busy
          ? 'deleted and busy'
          : this.delete
            ? 'deleted'
            : 'busy';
      throw new Error(
        `Attempting to set category ${newValue} on record ` +
          `that is currently ${recordState}`
      );
    }
    this.lowest4bits = newValue & 0b1111;
  }
}
