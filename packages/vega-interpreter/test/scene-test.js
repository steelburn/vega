import fs from 'fs';
import tape from 'tape';
import * as vega from 'vega';
import * as interp from '../index.js';
import specsValid from '../../vega/test/specs-valid.json' with { type: 'json' };

const OUTPUT_FAILURES = false; // flag to write scenes upon test failure
const specdir = process.cwd() + '/../vega/test/specs-valid/';
const testdir = process.cwd() + '/../vega/test/scenegraphs/';
const loader = vega.loader({baseURL: '../vega/test/'});
const specs = specsValid.filter(spec => {
  // filter wordcloud due to cross-platform canvas issues
  if (spec === 'wordcloud') {
    return false;
  }

  // filter basemap due to flaky ci
  if (spec === 'basemap') {
    return false;
  }

  return true;
});

// Plug-in a seeded random number generator for testing.
vega.setRandom(vega.randomLCG(123456789));

// Standardize font metrics to suppress cross-platform variance.
vega.textMetrics.canvas(false);

tape('Vega generates scenegraphs for specifications', t => {
  let count = specs.length;

  specs.forEach(async function(name, index) {
    try {
      const path = testdir + name + '.json',
            spec = JSON.parse(fs.readFileSync(specdir + name + '.vg.json')),
            runtime = vega.parse(spec, null, {ast: true}),
            view = new vega.View(runtime, {
              expr: interp.expressionInterpreter,
              loader: loader,
              renderer: 'none'
            }).finalize(); // remove timers, event listeners

      await view.runAsync();

      const actual = view.scenegraph().toJSON(2),
            expect = fs.readFileSync(path) + '',
            pair = [JSON.parse(actual), JSON.parse(expect)],
            isEqual = vega.sceneEqual(...pair);

      if (OUTPUT_FAILURES && !isEqual) {
        pair.forEach((scene, i) => {
          const prefix = vega.pad(index, 2, '0', 'left');
          fs.writeFileSync(
            `${prefix}-scene-${i?'expect':'actual'}-${name}.json`,
            JSON.stringify(scene, 0, 2)
          );
        });
      }

      t.ok(isEqual, 'scene: ' + name);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ERROR', err);
      t.fail(name);
    } finally {
      if (--count === 0) t.end();
    }
  });
});
