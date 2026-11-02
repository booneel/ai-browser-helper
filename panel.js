let task = null;
const $ = id => document.getElementById(id);
function setTask(next) {
  task = next;
  $('analyze').disabled = !next;
  $('preview').textContent = next?.mode === 'selection'
    ? `선택 문장 (${next.text.length}자): ${next.text.slice(0, 450)}`
    : next?.mode === 'screen' ? '현재 탭의 보이는 화면을 캡처했습니다. (이미지는 외부 API로 전송됩니다.)'
    : '분석할 내용을 선택하세요.';
}
async function send(message) {
  const res = await chrome.runtime.sendMessage(message);
  if (!res?.ok) throw new Error(res?.error || '요청 실패');
  return res;
}
async function prepare(mode) {
  $('status').textContent = '내용을 가져오는 중...';
  try {
    const result = await send({type:mode === 'screen' ? 'capture' : 'selection'});
    if (mode === 'selection' && !result.text.trim()) throw new Error('먼저 웹페이지에서 텍스트를 드래그하세요. 또는 마우스 오른쪽 클릭 메뉴를 사용하세요.');
    setTask(mode === 'screen' ? {mode, image:result.image} : {mode, text:result.text});
    $('status').textContent = '준비되었습니다.';
  } catch(e) { $('status').textContent = e.message; }
}
$('selection').addEventListener('click', () => prepare('selection'));
$('screen').addEventListener('click', () => prepare('screen'));
$('analyze').addEventListener('click', async () => {
  if (!task) return;
  $('analyze').disabled = true;
  $('status').textContent = 'AI 분석 중...';
  $('answer').textContent = '';
  try {
    const result = await send({type:'ask', ...task, question:$('question').value});
    $('answer').textContent = result.answer;
    $('status').textContent = '분석 완료';
  } catch(e) { $('status').textContent = `오류: ${e.message}`; }
  finally { $('analyze').disabled = false; }
});
(async () => {
  const {pendingTask} = await chrome.storage.session.get('pendingTask');
  if (pendingTask) {
    setTask(pendingTask);
    await chrome.storage.session.remove('pendingTask');
    $('status').textContent = '오른쪽 클릭으로 선택한 내용을 가져왔습니다.';
  }
})();
