chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({ id: 'explain-selection', title: 'AI로 선택 문장 설명', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'explain-screen', title: 'AI로 현재 탭 화면 설명', contexts: ['page', 'selection'] });
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.windowId) return;
  try {
    const payload = info.menuItemId === 'explain-selection'
      ? { mode: 'selection', text: info.selectionText || '' }
      : { mode: 'screen', image: await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 75 }) };
    await chrome.storage.session.set({ pendingTask: { ...payload, nonce: Date.now() } });
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) { console.error(e); }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'capture') {
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
      const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 75 });
      return { image };
    }
    if (message.type === 'selection') {
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
      const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || '' });
      return { text: result[0]?.result || '' };
    }
    if (message.type === 'ask') {
      const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
      if (!apiKey) throw new Error('먼저 설정 페이지에서 API 키를 입력하세요.');
      const content = [{type:'input_text', text: message.mode === 'screen'
        ? `다음 웹페이지 화면을 한국어로 설명해 주세요. 사용자의 질문: ${message.question || '화면의 주요 내용, 중요 항목 및 주의점을 설명해 주세요.'}`
        : `다음 선택 문장을 한국어로 명확하게 설명해 주세요. 사용자의 질문: ${message.question || '핵심 의미와 용어를 쉽게 설명해 주세요.'}\n\n선택 문장:\n${String(message.text || '').slice(0, 20000)}`}];
      if (message.mode === 'screen') {
        if (!message.image?.startsWith('data:image/')) throw new Error('화면 이미지가 없습니다.');
        content.push({ type: 'input_image', image_url: message.image, detail: 'auto' });
      }
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({model: model || 'gpt-5.5', store: false, input: [{role: 'user', content}]})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `API 오류 (${response.status})`);
      const answer = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
      return { answer: answer || '응답에서 설명 텍스트를 찾지 못했습니다.' };
    }
    throw new Error('알 수 없는 요청입니다.');
  })().then(v => sendResponse({ok:true, ...v})).catch(e => sendResponse({ok:false, error:e.message}));
  return true;
});
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}
