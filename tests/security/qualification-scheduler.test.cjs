const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('infraestrutura dedicada: callback, falhas, permissões e doze ciclos nativos',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','infra/qualification_scheduler','-p','test_*.py'],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
});
