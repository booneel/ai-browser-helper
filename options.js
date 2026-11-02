const $ = id => document.getElementById(id);
(async () => {const {apiKey,model} = await chrome.storage.local.get(['apiKey','model']); $('apiKey').value=apiKey||''; $('model').value=model||'gpt-5.5';})();
$('save').addEventListener('click', async () => {await chrome.storage.local.set({apiKey:$('apiKey').value.trim(),model:$('model').value.trim()||'gpt-5.5'});$('status').textContent='저장했습니다.';});
$('clear').addEventListener('click', async () => {await chrome.storage.local.remove('apiKey');$('apiKey').value='';$('status').textContent='API 키를 삭제했습니다.';});
