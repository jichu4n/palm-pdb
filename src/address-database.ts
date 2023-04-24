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
  AUSTRALIA = 'Australia',
  AUSTRIA = 'Austria',
  BELGIUM = 'Belgium',
  BRAZIL = 'Brazil',
  CANADA = 'Canada',
  DENMARK = 'Denmark',
  FINLAND = 'Finland',
  FRANCE = 'France',
  GERMANY = 'Germany',
  HONG_KONG = 'Hong Kong',
  ICELAND = 'Iceland',
  IRELAND = 'Ireland',
  ITALY = 'Italy',
  JAPAN = 'Japan',
  LUXEMBOURG = 'Luxembourg',
  MEXICO = 'Mexico',
  NETHERLANDS = 'Netherlands',
  NEW_ZEALAND = 'New Zealand',
  NORWAY = 'Norway',
  SPAIN = 'Spain',
  SWEDEN = 'Sweden',
  SWITZERLAND = 'Switzerland',
  UNITED_KINGDOM = 'United Kingdom',
  UNITED_STATES = 'United States',
}
/** List of supported countries and regions in AddressDB, indexed by code. */
const ADDRESS_COUNTRIES = Object.values(AddressCountry);

/** Field types in AddressDB.
 *
 * References:
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm#L424
 */
export enum AddressFieldType {
  LAST_NAME = 'lastName',
  FIRST_NAME = 'firstName',
  COMPANY = 'company',
  PHONE_1 = 'phone1',
  PHONE_2 = 'phone2',
  PHONE_3 = 'phone3',
  PHONE_4 = 'phone4',
  PHONE_5 = 'phone5',
  ADDRESS = 'address',
  CITY = 'city',
  STATE = 'state',
  ZIP_CODE = 'zipCode',
  COUNTRY = 'country',
  TITLE = 'title',
  CUSTOM_1 = 'custom1',
  CUSTOM_2 = 'custom2',
  CUSTOM_3 = 'custom3',
  CUSTOM_4 = 'custom4',
  NOTE = 'note',
  PHONE_6 = 'phone6',
  PHONE_7 = 'phone7',
  PHONE_8 = 'phone8',
}
/** List of field types in AddressDB, indexed by code. */
export const ADDRESS_FIELD_TYPES = Object.values(AddressFieldType);
/** Number of address fields (and field types). */
export const NUM_ADDRESS_FIELDS = 22;

/** Standard phone number field types in AddressDB.
 *
 * References:
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm#L159
 */
export enum PhoneNumberType {
  WORK = 'work',
  HOME = 'home',
  FAX = 'fax',
  OTHER = 'other',
  EMAIL = 'email',
  MAIN = 'main',
  PAGER = 'pager',
  MOBILE = 'mobile',
}
/** List of standard phone number fields in AddressDB, indexed by code. */
export const PHONE_NUMBER_TYPES = Object.values(PhoneNumberType);
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

  /** The country or region for which the labels were designed. */
  get country() {
    return ADDRESS_COUNTRIES[this.countryCode];
  }
  set country(newValue: AddressCountry) {
    const countryCode = ADDRESS_COUNTRIES.indexOf(newValue);
    if (countryCode < 0) {
      throw new Error(`Invalid country or region: ${newValue}`);
    }
    this.countryCode = countryCode;
  }
  @field(SUInt8)
  private countryCode = 0;

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
      type: ADDRESS_FIELD_TYPES[i],
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
      if (type !== ADDRESS_FIELD_TYPES[i]) {
        throw new Error(
          `Expected field[${i}] to have type ${ADDRESS_FIELD_TYPES[i]}, ` +
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

  toJSON() {
    return {
      ...super.toJSON(),
      ...pick(this, ['fields', 'country', 'sortByCompany']),
    };
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
        const fieldType = ADDRESS_FIELD_TYPES[i];
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
      const fieldType = ADDRESS_FIELD_TYPES[i];
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

  toJSON() {
    return pick(this, [
      'phoneNumberTypeMapping',
      'mainPhoneNumberType',
      'cells',
    ]);
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

  get mainPhoneNumberType() {
    return PHONE_NUMBER_TYPES[this.mainPhone];
  }
  set mainPhoneNumberType(newValue: PhoneNumberType) {
    this.mainPhone = PHONE_NUMBER_TYPES.indexOf(newValue);
  }
  @bitfield(4)
  private mainPhone = 0;

  get phoneNumberTypeMapping(): PhoneNumberTypeMapping {
    return {
      [AddressFieldType.PHONE_1]: PHONE_NUMBER_TYPES[this.phone1],
      [AddressFieldType.PHONE_2]: PHONE_NUMBER_TYPES[this.phone2],
      [AddressFieldType.PHONE_3]: PHONE_NUMBER_TYPES[this.phone3],
      [AddressFieldType.PHONE_4]: PHONE_NUMBER_TYPES[this.phone4],
      [AddressFieldType.PHONE_5]: PHONE_NUMBER_TYPES[this.phone5],
    };
  }
  set phoneNumberTypeMapping(newValue: PhoneNumberTypeMapping) {
    this.phone1 = PHONE_NUMBER_TYPES.indexOf(
      newValue[AddressFieldType.PHONE_1]
    );
    this.phone2 = PHONE_NUMBER_TYPES.indexOf(
      newValue[AddressFieldType.PHONE_2]
    );
    this.phone3 = PHONE_NUMBER_TYPES.indexOf(
      newValue[AddressFieldType.PHONE_3]
    );
    this.phone4 = PHONE_NUMBER_TYPES.indexOf(
      newValue[AddressFieldType.PHONE_4]
    );
    this.phone5 = PHONE_NUMBER_TYPES.indexOf(
      newValue[AddressFieldType.PHONE_5]
    );
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

  toJSON() {
    return pick(this, ['mainPhoneNumberType', 'phoneNumberTypeMap']);
  }
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
