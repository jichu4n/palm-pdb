import groupBy from 'lodash/groupBy';
import pick from 'lodash/pick';
import {
  bitfield,
  DeserializeOptions,
  field,
  SArray,
  SBitmask,
  SerializeOptions,
  SStringNT,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {AppInfoType, DatabaseHdrType, PdbDatabase, PdbRecord} from '.';

/** Maximum length of address field labels - 15 + 1 NUL byte. */
export const ADDRESS_FIELD_LABEL_LENGTH = 16;

/** Countries and regions in AddressDB.
 *
 * References:
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm#L170
 */
export enum AddressCountry {
  AUSTRALIA = 0,
  AUSTRIA = 1,
  BELGIUM = 2,
  BRAZIL = 3,
  CANADA = 4,
  DENMARK = 5,
  FINLAND = 6,
  FRANCE = 7,
  GERMANY = 8,
  HONG_KONG = 9,
  ICELAND = 10,
  IRELAND = 11,
  ITALY = 12,
  JAPAN = 13,
  LUXEMBOURG = 14,
  MEXICO = 15,
  NETHERLANDS = 16,
  NEW_ZEALAND = 17,
  NORWAY = 18,
  SPAIN = 19,
  SWEDEN = 20,
  SWITZERLAND = 21,
  UNITED_KINGDOM = 22,
  UNITED_STATES = 23,
}

/** Field types in AddressDB.
 *
 * References:
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm#L424
 */
export enum AddressFieldType {
  LAST_NAME = 0,
  FIRST_NAME = 1,
  COMPANY = 2,
  PHONE_1 = 3,
  PHONE_2 = 4,
  PHONE_3 = 5,
  PHONE_4 = 6,
  PHONE_5 = 7,
  ADDRESS = 8,
  CITY = 9,
  STATE = 10,
  ZIP_CODE = 11,
  COUNTRY = 12,
  TITLE = 13,
  CUSTOM_1 = 14,
  CUSTOM_2 = 15,
  CUSTOM_3 = 16,
  CUSTOM_4 = 17,
  NOTE = 18,
  PHONE_6 = 19,
  PHONE_7 = 20,
  PHONE_8 = 21,
}
/** Number of address fields (and field types). */
export const NUM_ADDRESS_FIELDS = 22;

/** Standard phone number field types in AddressDB.
 *
 * References:
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm#L159
 */
export enum PhoneNumberType {
  WORK = 0,
  HOME = 1,
  FAX = 2,
  OTHER = 3,
  EMAIL = 4,
  MAIN = 5,
  PAGER = 6,
  MOBILE = 7,
}
/** Standard phone number fields. */
export const PHONE_NUMBER_FIELD_TYPES: Array<PhoneNumberFieldType> = [
  AddressFieldType.PHONE_1,
  AddressFieldType.PHONE_2,
  AddressFieldType.PHONE_3,
  AddressFieldType.PHONE_4,
  AddressFieldType.PHONE_5,
];
export type PhoneNumberFieldType =
  | AddressFieldType.PHONE_1
  | AddressFieldType.PHONE_2
  | AddressFieldType.PHONE_3
  | AddressFieldType.PHONE_4
  | AddressFieldType.PHONE_5;

export function isPhoneNumberFieldType(
  fieldType: AddressFieldType
): fieldType is PhoneNumberFieldType {
  return PHONE_NUMBER_FIELD_TYPES.includes(fieldType as any);
}

/** Information about a field in AddressDB. */
export interface AddressField {
  /** Field type. */
  type: AddressFieldType;
  /** Label displayed to the user.
   *
   * Max length is ADDRESS_FIELD_LABEL_LENGTH - 1.
   */
  label: string;
  /** Dirty bit indicating whether this field has been renamed.  */
  isRenamed: boolean;
}

/** AddressDB AppInfo block. */
export class AddressAppInfo extends AppInfoType {
  @field(SUInt16BE)
  private padding2 = 0;

  /** Field information.
   *
   * Always has exactly NUM_ADDRESS_FIELDS elements.
   */
  fields: Array<AddressField> = [];
  @field(SUInt32BE)
  private renamedFields = 0;
  @field(
    SArray.of(SStringNT.ofLength(ADDRESS_FIELD_LABEL_LENGTH)).ofLength(
      NUM_ADDRESS_FIELDS
    )
  )
  private addressLabels: Array<string> = [];

  @field(SUInt8.enum(AddressCountry))
  country = AddressCountry.UNITED_STATES;

  @field(SUInt8)
  private padding3 = 0;

  /** Whether to sort the database by company - must be 0 or 1. */
  @field(SUInt8)
  sortByCompany = 0;

  @field(SUInt8)
  private padding4 = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const offset = super.deserialize(buffer, opts);
    this.fields = this.addressLabels.map((label, i) => ({
      type: i,
      label,
      isRenamed: !!(this.renamedFields & (1 << i)),
    }));
    return offset;
  }

  serialize(opts?: SerializeOptions) {
    if (this.fields.length !== NUM_ADDRESS_FIELDS) {
      throw new Error(
        `Fields array must have exactly ${NUM_ADDRESS_FIELDS} elements, ` +
          `found ${this.fields.length}`
      );
    }
    this.renamedFields = 0;
    this.addressLabels = [];
    for (let i = 0; i < this.fields.length; ++i) {
      const {type, label, isRenamed} = this.fields[i];
      if (type !== i) {
        throw new Error(
          `Expected field[${i}] to have type ${AddressFieldType[i]}, ` +
            `found ${type}`
        );
      }
      this.addressLabels.push(label);
      if (isRenamed) {
        this.renamedFields |= 1 << i;
      }
    }
    return super.serialize(opts);
  }
}

/** A cell in an AddressDB record. */
export interface AddressRecordCell {
  /** The corresponding field type. */
  fieldType: AddressFieldType;
  /** The phone number field, if this is a phone number field. */
  phoneNumberType?: PhoneNumberType;
  /** The actual data. */
  value: string;
}

/** An AddressDB record. */
export class AddressRecord extends PdbRecord {
  /** The "main" phone number type for this record. */
  get mainPhoneNumberType() {
    return this.phoneNumberTypeMappingBitmask.mainPhoneNumberType;
  }
  set mainPhoneNumberType(newValue: PhoneNumberType) {
    this.phoneNumberTypeMappingBitmask.mainPhoneNumberType = newValue;
  }
  /** Phone number type mapping for this record. */
  get phoneNumberTypeMapping() {
    return this.phoneNumberTypeMappingBitmask.phoneNumberTypeMapping;
  }
  set phoneNumberTypeMapping(newValue: PhoneNumberTypeMapping) {
    this.phoneNumberTypeMappingBitmask.phoneNumberTypeMapping = newValue;
  }
  @field()
  private phoneNumberTypeMappingBitmask = new PhoneNumberTypeMappingBitmask();

  /** Cells in this record.
   *
   * A record can contain up to NUM_ADDRESS_FIELDS cells, one for each
   * AddressFieldType.
   *
   * This array can be manipulated directly or via the get() and set() methods.
   */
  cells: Array<AddressRecordCell> = [];
  @field(SUInt32BE)
  private fieldsBitmask = 0;
  @field(SUInt8)
  private companyCellValueOffset = 0;
  @field(SArray.of(SStringNT))
  private values: Array<string> = [];

  /** Returns the cell value for a field type in this record, or undefined if
   * not present.
   */
  get(fieldType: AddressFieldType) {
    return this.cells.find((cell) => cell.fieldType === fieldType)?.value;
  }
  /** Sets the cell value for a field type.
   *
   * If field type was already present on this record, the previous cell value
   * is overwritten. Otherwise, a new cell is appended.
   */
  set(fieldType: AddressFieldType, value: string) {
    const cell = this.makeCell(fieldType, value);
    const existingCellIdx = this.cells.findIndex(
      (cell) => cell.fieldType === fieldType
    );
    if (existingCellIdx >= 0) {
      this.cells[existingCellIdx] = cell;
    } else {
      this.cells.push(cell);
    }
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    this.cells = [];
    this.values = [];
    let offset = super.deserialize(buffer, opts);
    const s = new SStringNT();
    for (let i = 0; i < NUM_ADDRESS_FIELDS; ++i) {
      if (this.fieldsBitmask & (1 << i)) {
        offset += s.deserialize(buffer.subarray(offset), opts);
        const fieldType = i;
        this.cells.push(this.makeCell(fieldType, s.value));
      }
    }
    return offset;
  }

  serialize(opts?: SerializeOptions) {
    this.fieldsBitmask = 0;
    this.values = [];
    this.companyCellValueOffset = 0;
    const cellsByFieldType = groupBy(this.cells, ({fieldType}) => fieldType);
    for (let i = 0, companyCellValueOffset = 0; i < NUM_ADDRESS_FIELDS; ++i) {
      const fieldType = i;
      const cells = cellsByFieldType[fieldType];
      if (!cells) {
        continue;
      }
      if (cells.length !== 1) {
        throw new Error(
          `Found ${cells.length} cells with field type ${fieldType}: ` +
            cells.map(({value}) => `"${value}"`).join(', ')
        );
      }
      const {value, phoneNumberType} = cells[0];
      if (isPhoneNumberFieldType(fieldType)) {
        if (
          phoneNumberType &&
          phoneNumberType !== this.phoneNumberTypeMapping[fieldType]
        ) {
          throw new Error(
            `Incorrect phone number type in cell ${fieldType}: ` +
              `phoneNumberTypeMapping[${fieldType}] is ${this.phoneNumberTypeMapping[fieldType]}, ` +
              `but cell has phone number type ${phoneNumberType}`
          );
        }
      } else {
        if (phoneNumberType) {
          throw new Error(
            `${fieldType} is not a phone number field and should not have phoneNumberType set ` +
              `(found ${phoneNumberType})`
          );
        }
      }
      this.fieldsBitmask |= 1 << i;
      this.values.push(value);
      if (fieldType === AddressFieldType.COMPANY) {
        this.companyCellValueOffset = companyCellValueOffset + 1;
      } else if (this.companyCellValueOffset === 0) {
        companyCellValueOffset += value.length + 1;
      }
    }
    return super.serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions) {
    this.values = this.cells.map(({value}) => value);
    return super.getSerializedLength(opts);
  }

  private makeCell(fieldType: AddressFieldType, value: string) {
    return {
      fieldType,
      ...(isPhoneNumberFieldType(fieldType)
        ? {
            phoneNumberType: this.phoneNumberTypeMapping[fieldType],
          }
        : {}),
      value,
    };
  }
}

/** Mapping from address field type to phone number type. */
export type PhoneNumberTypeMapping = {
  [key in PhoneNumberFieldType]: PhoneNumberType;
};

class PhoneNumberTypeMappingBitmask extends SBitmask.of(SUInt32BE) {
  @bitfield(8)
  private padding1 = 0;

  @bitfield(4)
  mainPhoneNumberType = PhoneNumberType.WORK;

  get phoneNumberTypeMapping(): PhoneNumberTypeMapping {
    return {
      [AddressFieldType.PHONE_1]: this.phone1,
      [AddressFieldType.PHONE_2]: this.phone2,
      [AddressFieldType.PHONE_3]: this.phone3,
      [AddressFieldType.PHONE_4]: this.phone4,
      [AddressFieldType.PHONE_5]: this.phone5,
    };
  }
  set phoneNumberTypeMapping(newValue: PhoneNumberTypeMapping) {
    this.phone1 = newValue[AddressFieldType.PHONE_1];
    this.phone2 = newValue[AddressFieldType.PHONE_2];
    this.phone3 = newValue[AddressFieldType.PHONE_3];
    this.phone4 = newValue[AddressFieldType.PHONE_4];
    this.phone5 = newValue[AddressFieldType.PHONE_5];
  }
  @bitfield(4)
  private phone5 = 4;
  @bitfield(4)
  private phone4 = 3;
  @bitfield(4)
  private phone3 = 2;
  @bitfield(4)
  private phone2 = 1;
  @bitfield(4)
  private phone1 = 0;
}

/** AddressDB database.
 *
 * References:
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/address.c
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm
 */
export class AddressDatabase extends PdbDatabase.of(
  AddressRecord,
  AddressAppInfo
) {
  header = DatabaseHdrType.with({
    name: 'AddressDB',
    type: 'DATA',
    creator: 'addr',
  });
}
