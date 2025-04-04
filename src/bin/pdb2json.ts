#!/usr/bin/env node

import {program} from 'commander';
import fs from 'fs-extra';
import {
  AddressDatabase,
  DatebookDatabase,
  DEFAULT_ENCODING,
  MemoDatabase,
  PalmDocDatabase,
  PdbDatabase,
  RawPdbDatabase,
  Record,
  RecordEntryType,
  ToDoDatabase,
} from '..';
import {Serializable} from 'serio';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../package.json');

interface DatabaseRegistryEntry {
  creator: string;
  type: string;
  databaseType: new () => PdbDatabase<
    Record<RecordEntryType>,
    Serializable,
    Serializable
  >;
  label: string;
}

const DATABASE_REGISTRY: Array<DatabaseRegistryEntry> = [
  {creator: 'memo', type: 'DATA', databaseType: MemoDatabase, label: 'Memo'},
  {creator: 'todo', type: 'DATA', databaseType: ToDoDatabase, label: 'ToDo'},
  {
    creator: 'date',
    type: 'DATA',
    databaseType: DatebookDatabase,
    label: 'Datebook',
  },
  {
    creator: 'addr',
    type: 'DATA',
    databaseType: AddressDatabase,
    label: 'Address',
  },
  {
    creator: 'REAd',
    type: 'TEXt',
    databaseType: PalmDocDatabase,
    label: 'PalmDOC',
  },
];

if (require.main === module) {
  (async () => {
    program.name('pdb2json').version(packageJson.version);

    program
      .description(
        [
          'Decode a PDB file and print it to JSON.',
          'Supported formats: ' +
            DATABASE_REGISTRY.map(({label}) => label).join(', '),
        ].join('\n')
      )
      .argument('<pdb-file>', 'Path to PDB file')
      .option(
        '--input-encoding <encoding>',
        'text encoding of input PalmDOC PDB file',
        DEFAULT_ENCODING
      )
      .action(async (inputFilePath, options) => {
        // Read input file into buffer.
        let pdbBuffer: Buffer;
        let rawDb: RawPdbDatabase;
        try {
          pdbBuffer = await fs.readFile(inputFilePath);
          rawDb = RawPdbDatabase.from(pdbBuffer);
        } catch (e) {
          console.error(
            `Could not open '${inputFilePath}': ` +
              (e instanceof Error ? e.message : String(e))
          );
          process.exit(1);
        }

        // Find corresponding database type.
        const {creator, type} = rawDb.header;
        const dbRegistryEntry = DATABASE_REGISTRY.find(
          (entry) => entry.creator === creator && entry.type === type
        );
        if (!dbRegistryEntry) {
          console.error(
            `Unknown database type: creator "${creator}", type "${type}"`
          );
          process.exit(1);
        }

        // Re-parse the file using the correct database.
        const db = new dbRegistryEntry.databaseType();
        try {
          db.deserialize(pdbBuffer, {encoding: options.inputEncoding});
        } catch (e) {
          console.error(
            `Could not parse '${inputFilePath}': ` +
              (e instanceof Error ? e.message : String(e))
          );
          process.exit(1);
        }

        // Print out result.
        console.log(JSON.stringify(db, null, 4));
      });

    await program.parseAsync();
  })();
}
