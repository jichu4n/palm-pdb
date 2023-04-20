import sum from 'lodash/sum';
import {
  DeserializeOptions,
  SArray,
  SString,
  SUInt32BE,
  Serializable,
  SerializableWrapper,
  SerializeOptions,
} from 'serio';

/** An array encoded as a number N followed by N elements. */
export abstract class SDynamicArray<
  LengthT extends SerializableWrapper<number>,
  ValueT extends Serializable
> extends SerializableWrapper<Array<ValueT>> {
  /** Array of Serializables. */
  value: Array<ValueT> = [];
  /** Length type, to be provided by child classes. */
  protected abstract readonly lengthType: new () => LengthT;
  /** Element type, to be provided by child classes. */
  protected abstract readonly valueType: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const length = new this.lengthType();
    let readOffset = length.deserialize(buffer, opts);
    const sArray = new (SArray.ofLength(length.value, this.valueType))();
    readOffset += sArray.deserialize(buffer.subarray(readOffset), opts);
    this.value.splice(0, this.value.length, ...sArray.value);
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return Buffer.concat([
      length.serialize(opts),
      SArray.ofLength(this.value.length, this.valueType)
        .of(this.value)
        .serialize(opts),
    ]);
  }

  getSerializedLength(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return (
      length.getSerializedLength(opts) +
      sum(this.value.map((value) => value.getSerializedLength(opts)))
    );
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT extends Serializable, SDynamicArrayT extends SArray<ValueT>>(
    this: new () => SDynamicArrayT,
    value: Array<ValueT>
  ): SDynamicArrayT;
  /** Returns an SDynamicArray class with the given length and value types. */
  static of<
    LengthT extends SerializableWrapper<number>,
    ValueT extends Serializable
  >(
    lengthType: new () => LengthT,
    valueType: new () => ValueT
  ): ReturnType<typeof createSDynamicArray<LengthT, ValueT>>;
  static of<
    LengthT extends SerializableWrapper<number>,
    ValueT extends Serializable
  >(arg1: Array<ValueT> | (new () => LengthT), arg2?: new () => ValueT) {
    if (Array.isArray(arg1)) {
      return super.of(arg1);
    }
    if (
      typeof arg1 === 'function' &&
      arg1.prototype instanceof SerializableWrapper &&
      typeof arg2 === 'function' &&
      arg2.prototype instanceof Serializable
    ) {
      return createSDynamicArray(arg1, arg2);
    }
    throw new Error(
      'SDynamicArray.of() should be invoked either with an array of Serializable ' +
        'values, or a length type constructor and a value type constructor'
    );
  }
}

function createSDynamicArray<
  LengthT extends SerializableWrapper<number>,
  ValueT extends Serializable
>(lengthType: new () => LengthT, valueType: new () => ValueT) {
  return class extends SDynamicArray<LengthT, ValueT> {
    lengthType = lengthType;
    valueType = valueType;
  };
}

/** Serializable wrapper for a 32-bit type ID mapped to a 4-character string. */
export class TypeId extends SString.ofLength(4) {
  value = 'AAAA';
}

/** Memory offset, i.e. "local (card relative) chunk ID" according to the SDK. */
export const LocalId = SUInt32BE;

/** Unique ID of records in PDB databases.
 *
 * Each unique ID is encoded as a 24-bit big endian unsigned integer. Valid
 * records should have a non-zero unique ID.
 */
export class RecordId extends SerializableWrapper<number> {
  value = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    // Reference: https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L258
    this.value =
      (buffer.readUInt8(0) << 16) |
      (buffer.readUInt8(1) << 8) |
      buffer.readUInt8(2);
    return 3;
  }
  serialize(opts?: SerializeOptions) {
    // Reference: https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L1246
    return Buffer.of(
      (this.value >> 16) & 0xff,
      (this.value >> 8) & 0xff,
      this.value & 0xff
    );
  }
  getSerializedLength(opts?: SerializeOptions) {
    return 3;
  }
}

/** Default text encoding for Palm OS PDB files. */
export const DEFAULT_ENCODING = 'cp1252';
