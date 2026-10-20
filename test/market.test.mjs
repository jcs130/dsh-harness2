import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMarketIndex,marketInstallTarget} from '@deepseek-ai/dsh-plugin-market-index';

test('official DSH market parser yields the publicly verified immutable Git install source',()=>{
  const raw=JSON.parse(readFileSync(new URL('../market/index.json',import.meta.url),'utf8'));
  const index=parseMarketIndex(raw,'https://raw.githubusercontent.com/jcs130/dsh-harness2/main/market/index.json');
  assert.equal(index.plugins.length,1);
  const plugin=index.plugins[0],version=plugin.versions[0];
  assert.equal(plugin.name,'@jcs130/dsh-harness2');assert.equal(version.version,'0.1.0-rc.1');assert.deepEqual(plugin.metadata.labels,['preview']);
  assert.equal(marketInstallTarget(plugin.name,version).spec,'git+https://github.com/jcs130/dsh-harness2.git#811c598215f2ea955e63389898e13b06ca2289b2');
});
