# palm-pdb

TypeScript library for working with Palm OS PDB and PRC files.

palm-pdb provides a API for reading and writing Palm OS PDB and PRC files using TypeScript / JavaScript. It also provides implementations of several common PDB data formats out of the box, including those used by the core Palm OS PIM applications (Memo Pad, Date Book, Address, To Do List) and PalmDOC.

While palm-pdb doesn't directly communicate with a Palm OS device, it can be used to parse PDB / PRC files backed up from a device, or to produce PDB / PRC files that can be synced to a device.

## Quickstart

Install with:

```
npm install --save palm-pdb
```

Basic usage:

```ts
import {MemoDatabase, MemoRecord} from 'palm-pdb';
import fs from 'fs-extra';

// Let's read some memos!
const memoDb = MemoDatabase.from(await fs.readFile('MemoDB.pdb'));
const record = memoDb.records[0];
console.log(record.value); // "Hello world!"
console.log(
  memoDb.appInfo.getCategory(record.entry.attributes.category)!.label
); // "Personal"

// Let's add a new memo!
const newRecord = new MemoRecord();
newRecord.value = 'Look, new memo!';
newRecord.entry.attributes.category = memoDb.appInfo.getCategory('Work').uniqId;
memoDb.records.push(newRecord);
await fs.writeFile('MemoDB.pdb', memoDb.serialize());
```

## Requirements

TypeScript is not required if you just want to use the out-of-the-box implementations of common PDB data formats (Date Book, To Do List, PalmDOC, etc.).

On the other hand, if you'd like to implement custom PDB / PRC formats, then the following is required:

1. TypeScript 5.0 or higher;
2. The `experimentalDecorators` setting should NOT be enabled in `tsconfig.json`.

## Usage

The following sections provide a high level overview of the API. For more details, please see [the generated documentation](https://jichu4n.github.io/palm-pdb).

### Core concepts

The [Database](https://jichu4n.github.io/palm-pdb/classes/Database.html) class is the logical representation of a PDB / PRC file. Its member fields correspond to the high level structure described in the [Palm File Format Specification](https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf):

- `header`: Standard structure ([DatabaseHdrType](https://jichu4n.github.io/palm-pdb/classes/DatabaseHdrType)) for basic metadata, such as name, creator and type information.
- `appInfo`: Optional block for application settings or other data. The format is up to the application, but there is a standard structure ([AppInfoType](https://jichu4n.github.io/palm-pdb/classes/AppInfoType)) for category settings that is used by all the built-in PIM applications.
- `sortInfo`: Optional block for record ordering information. The format is up to the application.
- `records`: An array of records ([Record](https://jichu4n.github.io/palm-pdb/classes/Record.html)). Each record has an associated `entry` ([EntryType](https://jichu4n.github.io/palm-pdb/types/EntryType.html)) which is a standard structure containing metadata about each record. Otherwise the format is up to the application.

There are two sets of classes dervied from the ones described above, corresponding to the PDB and PRC formats respectively:

| Base                                                                 | PDB format                                                                         | PRC format                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [Database](https://jichu4n.github.io/palm-pdb/classes/Database.html) | [PdbDatabase](https://jichu4n.github.io/palm-pdb/classes/PdbDatabase.html)         | [PrcDatabase](https://jichu4n.github.io/palm-pdb/classes/PrcDatabase.html)     |
| [Record](https://jichu4n.github.io/palm-pdb/classes/Record.html)     | [PdbRecord](https://jichu4n.github.io/palm-pdb/classes/PdbRecord.html)             | [PrcRecord](https://jichu4n.github.io/palm-pdb/classes/PrcRecord.html)         |
| [EntryType](https://jichu4n.github.io/palm-pdb/types/EntryType.html) | [RecordEntryType](https://jichu4n.github.io/palm-pdb/classes/RecordEntryType.html) | [RsrcEntryType](https://jichu4n.github.io/palm-pdb/classes/RsrcEntryType.html) |

Implementations of specific formats derive from the above `Pdb*` or `Prc*` classes. See below for more information on implementing custom formats based on these classes.

### Serialization / deserialization

All of the classes described above implement the [`Serializable`](https://jichu4n.github.io/serio/#serializable) interface from the [serio](https://github.com/jichu4n/serio) library. A basic example illustrating the interface:

```ts
// Construct a new database
const db1 = new FooDatabase();
const rec1 = new FooRecord();
// Manipulate some fields
rec1.field1 = 3;
db1.records.push(rec1);
// Serialize to Buffer
const buf1 = db1.serialize();

// Deserialize a database from Buffer
const db2 = FooDatabase.from(buf1);
// The following achieves the same:
const db3 = new FooDatabase();
db3.deserialize(buf1);
```

### Text encoding

PDB / PRC files generally use one of several pre-Unicode text encodings, depending on the Palm OS language setting. The default encoding for the Latin alphabet is CP1252 ([`DEFAULT_ENCODING`](https://jichu4n.github.io/palm-pdb/variables/DEFAULT_ENCODING.html)), so that's what palm-pdb defaults to as well.

To select a different text encoding, pass in an `encoding` name during serialization / deserialization:

```ts
// Deserialize a MemoDB file using GB2312 text encoding (Simplified Chinese):
const db1 = MemoDatabase.from(buffer, {encoding: 'gb2312'});
// Alternatively:
const db2 = new MemoDatabase();
db2.deserialize(buffer, {encoding: 'gb2312'});

// Serialize a MemoDB file using Shift-JIS text encoding (Japanese):
const buf1 = db3.serialize({encoding: 'shiftjis'});
```

If you are unsure what text encoding is used in a particular file or in a particular version of Palm OS, see [here](https://github.com/jichu4n/palm-os-sdk/blob/a7a3d4ad02a939f8b91db8018065ebcf05cdf276/sdk-5r3/include/Core/System/PalmLocale.h#L487) for the full list of text encodings supported by Palm OS.

To find the `encoding` name that corresponds to a particular text encoding, see [the iconv-lite wiki](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings).

### Included PDB format implementations

Implementations of the following PDB formats are included in palm-pdb:

#### MemoDB

👉 [MemoDatabase](https://jichu4n.github.io/palm-pdb/classes/MemoDatabase.html), [MemoAppInfo](https://jichu4n.github.io/palm-pdb/classes/MemoAppInfo.html), [MemoRecord](https://jichu4n.github.io/palm-pdb/classes/MemoRecord.html)

Data format used by the **Memo Pad** (a.k.a. **Memos**) application.

#### DatebookDB

👉 [DatebookDatabase](https://jichu4n.github.io/palm-pdb/classes/DatebookDatabase.html), [DatebookAppInfo](https://jichu4n.github.io/palm-pdb/classes/DatebookAppInfo.html), [DatebookRecord](https://jichu4n.github.io/palm-pdb/classes/DatebookRecord.html)

Data format used by the **Date Book** (a.k.a. **Calendar**) application.

#### ToDoDB

👉 [ToDoDatabase](https://jichu4n.github.io/palm-pdb/classes/ToDoDatabase.html), [ToDoAppInfo](https://jichu4n.github.io/palm-pdb/classes/ToDoAppInfo.html), [ToDoRecord](https://jichu4n.github.io/palm-pdb/classes/ToDoRecord.html)

Data format used by the **To Do List** (a.k.a. **Tasks**) application.

#### AddressDB

👉 [AddressDatabase](https://jichu4n.github.io/palm-pdb/classes/AddressDatabase.html), [AddressAppInfo](https://jichu4n.github.io/palm-pdb/classes/AddressAppInfo.html), [AddressRecord](https://jichu4n.github.io/palm-pdb/classes/AddressRecord.html)

Data format used by the **Address** (a.k.a. **Contacts**) application.

#### PalmDOC

👉 [PalmDoc](https://jichu4n.github.io/palm-pdb/classes/PalmDoc.html)

Data format for text documents and eBooks. See [src/bin/palmdoc.ts](https://github.com/jichu4n/palm-pdb/blob/master/src/bin/palmdoc.ts) for a working example.

## Acknowledgements

Information regarding PDB / PRC data formats is based on the following sources:

- [Palm File Format Specification](https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf)
- [Palm OS SDKs](https://github.com/jichu4n/palm-os-sdk)
- [p5-Palm](https://github.com/madsen/p5-Palm/) by Andrew Arensburger, Alessandro Zummo, Brian D. Foy, Christopher J. Madsen et al.
- pilot-link ([archive](https://github.com/jichu4n/pilot-link)) by David A. Desrosiers, JP Rosevear, Kenneth Albanowski et al.

Wherever possible, the names of classes and fields are derived from their equivalents in the official Palm OS SDKs and the Palm File Format Specification.
