/**
 * How the classifier reads mesh names: one line per name with the part it
 * lands on, its position and variant. For naming a model's objects so they
 * sort into parts on import.
 *
 *   npx tsx scripts/dev/classify-names.mts body hood bumper_F_offroad fender_L …
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Classifier } from '../../src/shared/taxonomy/classify.ts';
import { TaxonomyFileSchema } from '../../src/shared/taxonomy/schema.ts';

const tax = TaxonomyFileSchema.parse(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'shared', 'taxonomy', 'taxonomy.json'), 'utf8')));
const classifier = new Classifier(tax.entries);
for (const name of process.argv.slice(2)) {
  const c = classifier.classify(name);
  console.log(`${name.padEnd(28)} ${(c.taxonomyId ?? '-').padEnd(20)} ${(c.position ?? '-').padEnd(4)} ${c.variant || '-'}  ${c.confidence.toFixed(2)}`);
}
