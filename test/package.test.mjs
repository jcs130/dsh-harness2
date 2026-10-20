import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('standalone package has no Minecraft dependency, nested URL dependency or install-time build',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))),lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url)));
  assert.equal(pkg.name,'@jcs130/dsh-harness2');assert.equal(pkg.dsh.client.platform,'web');
  for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.peerDependencies,...pkg.devDependencies})){
    assert.ok(!/minecraft|agent-mc/.test(name));assert.ok(!/^(https?:|git|file:|workspace:)/.test(version));
  }
  for(const value of Object.values(lock.packages)){if(value.resolved)assert.ok(value.resolved.startsWith('https://registry.npmjs.org/'));}
  assert.ok(!pkg.scripts.install);assert.ok(!pkg.scripts.postinstall);assert.ok(!pkg.scripts.prepare);assert.ok(!/scripts[\\/]build\.mjs/.test(pkg.scripts.prepack));
  assert.ok(!pkg.files.some(p=>/test|\.runtime|worker\.local|node_modules|package-lock/.test(p)));
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/verify-build.mjs',import.meta.url))],{cwd:new URL('..',import.meta.url)});
});
