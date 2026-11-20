// Every curriculum file the bundled pages and Apps Script load (curriculum/index.json lists
// them; a test checks this file matches). For esbuild bundles only: Node tests read the
// JSON files directly (tests/helpers).

import domainsIndex from './graph/domains.json';
import wholeGraph from './graph/whole.json';
import intGraph from './graph/int.json';
import fracGraph from './graph/frac.json';
import algGraph from './graph/alg.json';
import decGraph from './graph/dec.json';
import wholeMisconceptions from './misconceptions/whole.json';
import intMisconceptions from './misconceptions/int.json';
import fracMisconceptions from './misconceptions/frac.json';
import algMisconceptions from './misconceptions/alg.json';
import decMisconceptions from './misconceptions/dec.json';
import diagnosticConfig from './diagnostic/frac.json';
import masteryRules from './mastery.json';
import wholeAddSubLesson from './lessons/whole.add-sub.json';
import wholeMultDivLesson from './lessons/whole.mult-div.json';
import wholeFactorsMultiplesLesson from './lessons/whole.factors-multiples.json';
import fracMeaningLesson from './lessons/frac.meaning.json';
import fracEquivalentLesson from './lessons/frac.equivalent.json';
import fracCompareLesson from './lessons/frac.compare.json';
import fracAddSubLesson from './lessons/frac.add-sub.json';
import fracMultiplyLesson from './lessons/frac.multiply.json';
import fracDivideLesson from './lessons/frac.divide.json';
import intAddSubLesson from './lessons/int.add-sub.json';
import intMultDivLesson from './lessons/int.mult-div.json';
import fracSignedLesson from './lessons/frac.signed.json';
import algOrderOpsLesson from './lessons/alg.order-ops.json';
import algExponentsLesson from './lessons/alg.exponents.json';
import algEquationsLesson from './lessons/alg.equations.json';
import algExpressionsLesson from './lessons/alg.expressions.json';

export { domainsIndex, diagnosticConfig, masteryRules };
export const graphFiles = { 'whole.json': wholeGraph, 'int.json': intGraph, 'frac.json': fracGraph, 'alg.json': algGraph, 'dec.json': decGraph };
export const misconceptionList = [...wholeMisconceptions.misconceptions, ...intMisconceptions.misconceptions, ...fracMisconceptions.misconceptions, ...algMisconceptions.misconceptions, ...decMisconceptions.misconceptions];
export const lessons = [wholeAddSubLesson, wholeMultDivLesson, wholeFactorsMultiplesLesson, fracMeaningLesson, fracEquivalentLesson, fracCompareLesson, fracAddSubLesson, fracMultiplyLesson, fracDivideLesson, intAddSubLesson, intMultDivLesson, fracSignedLesson, algOrderOpsLesson, algExponentsLesson, algEquationsLesson, algExpressionsLesson];
