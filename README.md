# palm-pdb

TypeScript library for working with Palm OS PDB and PRC files.

palm-pdb provides a set of tools for reading and writing Palm OS PDB and PRC
files (a.k.a. "databases") in TypeScript / JavaScript. In addition to a general
framework, it provides ready-made implementations of some common PDB file
formats, including those used by the standard Palm OS PIM applications
(Datebook, Address, ToDo, Memo) and PalmDOC.

## Quickstart

### Installation

```
npm install --save palm-pdb
```

Requirements:

TypeScript is not required if you just want to use the ready-made
implementations of common PDB file formats (Datebook, Address, Memo, PalmDOC,
etc.).

On the other hand, if you'd like to build on the general framework to implement
your own custom PDB / PRC formats, then the following is required:

1. TypeScript 5.0 or higher;
2. The `experimentalDecorators` setting should NOT be enabled in `tsconfig.json`.

### Basic usage

```ts
import _ from 'lodash';
import fs from 'fs-extra';
import {MemoDatabase} from 'palm-pdb';

// Let's read some memos!
const memoDb = MemoDatabase.from(await fs.readFile('MemoDB.pdb'));
console.log(memoDb.records[0].value); // "Hello world!"
console.log(
  memoDb.appInfo.getCategory(memoDb.records[0].entry.attributes.category)
); // "Personal"
```
