import pick from 'lodash/pick';
import {
  field,
  SArray,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {AppInfoType, DatabaseHdrType, PdbDatabase, PdbRecord} from '.';

/** Maximum number of address fields. */
export const NUM_ADDRESS_FIELDS = 22;

/** Maximum length of address field labels - 15 + 1 NUL byte. */
export const ADDRESS_FIELD_LABEL_LENGTH = 16;

/** Countries and regions supported by AddressDB.
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
/** List of supported countries and regions, indexed by code. */
export const ADDRESS_COUNTRIES = Object.values(AddressCountry);

/** AddressDB AppInfo block. */
export class AddressAppInfo extends SObject {
  /** Standard category info. */
  @field()
  categoryInfo = new AppInfoType();

  @field(SUInt16BE)
  private padding1 = 0;

  @field(SUInt32BE)
  private renamedLabels = 0;
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
  private padding2 = 0;

  /** Whether to sort the database by company - must be 0 or 1. */
  @field(SUInt8)
  sortByCompany = 0;

  @field(SUInt8)
  private padding3 = 0;

  toJSON() {
    return pick(this, [
      'categoryInfo',
      'renamedLabels',
      'addressLabels',
      'country',
      'sortByCompany',
    ]);
  }
}

/** An AddressDB record. */
export class AddressRecord extends PdbRecord {}

/** MemoDB database.
 *
 * References:
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/address.c
 *   - https://github.com/madsen/p5-Palm/blob/master/lib/Palm/Address.pm
 */
export class AddressDatabase extends PdbDatabase.of(
  AddressRecord,
  AddressAppInfo
) {
  get defaultHeader() {
    return DatabaseHdrType.with({
      name: 'AddressDB',
      type: 'DATA',
      creator: 'addr',
    });
  }
}
