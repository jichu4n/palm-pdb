# palm-pdb

TypeScript library for working with Palm OS PDB and PRC files.

palm-pdb provides a simple API for reading and writing Palm OS PDB and PRC files using TypeScript / JavaScript. It supports several common PDB file formats out-of-the-box, including those used by the core Palm OS PIM (Memos, Calendar, Contacts, Tasks) and PalmDOC. It also provides a generic set of tools for manipulating arbitrary PDB and PRC files.

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
console.log(memoDb.appInfo.getCategory(record.entry.attributes.category)); // "Personal"

// Let's add a new memo!
const newRecord = new MemoRecord();
newRecord.value = 'Look, new memo!';
newRecord.entry.attributes.category = memoDb.appInfo.getCategory('Work').uniqId;
memoDb.records.push(newRecord);
await fs.writeFile('MemoDB.pdb', memoDb.serialize());
```

## Requirements

TypeScript is not required if you just want to use the out-of-the-box implementations of common PDB file formats (Calendar, Tasks, PalmDOC, etc.).

On the other hand, if you'd like to implement custom PDB / PRC formats, then the following is required:

1. TypeScript 5.0 or higher;
2. The `experimentalDecorators` setting should NOT be enabled in `tsconfig.json`.

## Usage

The following sections provide a high level overview of the API. For more details, please see [the generated documentation](https://jichu4n.github.io/palm-pdb).

### Core concepts

The [Database](https://jichu4n.github.io/palm-pdb/classes/Database.html) class is the logical representation of a PDB / PRC file. Its member fields correspond to the high level structure described in the [Palm File Format Specification](https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf):

- `header`: A fixed structure ([DatabaseHdrType](https://jichu4n.github.io/palm-pdb/classes/DatabaseHdrType)) containing basic metadata about the file, such as name, type information, and creation timestamp.
- `appInfo`: An optional block for storing application settings or other data. The format is up to the application, but there is a standard structure ([AppInfoType](https://jichu4n.github.io/palm-pdb/classes/AppInfoType)) for category settings that is used by all the built-in PIM applications.
- `sortInfo`: An optional block for record ordering information. The format is completely up to the application.
- `records`: A list of records ([Record](https://jichu4n.github.io/palm-pdb/classes/Record.html)). Each record has an associated `entry` ([EntryType](https://jichu4n.github.io/palm-pdb/types/EntryType.html)) which is a standard structure storing metadata about each record.

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

### MemoDB

👉 [MemoDatabase](https://jichu4n.github.io/palm-pdb/classes/MemoDatabase.html), [MemoAppInfo](https://jichu4n.github.io/palm-pdb/classes/MemoAppInfo.html), [MemoRecord](https://jichu4n.github.io/palm-pdb/classes/MemoRecord.html)

Format used by the Palm OS Memos (a.k.a. Memo Pad) application. TODO

#### Note on naming

Wherever possible, the names of classes and fields are derived from their equivalents in the [official Palm OS SDKs](https://github.com/jichu4n/palm-os-sdk) and the [Palm File Format Specification](https://jichu4n.github.io/palm-pdb/assets/Palm%20File%20Format%20Specification.pdf). Unfortunately, this also means we inherit some weird inconsistencies in naming, such as `uniqId` vs `uniqueId`.

#### Encoding

TODO
