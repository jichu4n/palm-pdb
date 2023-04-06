import _ from 'lodash';
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
> extends SArray<ValueT> {
  /** Length type, to be provided by child classes. */
  protected abstract lengthType: new () => LengthT;
  /** Element type, to be provided by child classes. */
  protected abstract valueType: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const length = new this.lengthType();
    let readOffset = length.deserialize(buffer, opts);
    this.value = _.times(length.value, () => new this.valueType());
    readOffset += super.deserialize(buffer.slice(readOffset), opts);
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return Buffer.concat([length.serialize(opts), super.serialize(opts)]);
  }

  getSerializedLength(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return length.getSerializedLength(opts) + super.getSerializedLength(opts);
  }
}

/** Serializable wrapper for a 32-bit type ID mapped to a 4-character string. */
export class TypeId extends SString.ofLength(4) {
  value = 'AAAA';
}

/** Memory offset, i.e. "local (card relative) chunk ID" according to the SDK. */
export type LocalID = SUInt32BE;