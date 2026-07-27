export function renderMarkdown(text) {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    codeBlocks.push(code.trim());
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    inlineCodes.push(code);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-2 mb-1">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-2 mb-1">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-2 mb-1">$1</h1>');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  html = html.replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4 list-decimal">$2</li>');

  html = html.replace(/(<li[\s\S]*?<\/li>\s*)+/g, (match) => {
    return `<ul class="my-2 space-y-1">${match}</ul>`;
  });

  html = html.replace(/\n\s*\n/g, '</p><p class="mb-2">');
  html = html.replace(/\n/g, '<br />');

  html = html.replace(/__INLINE_CODE_(\d+)__/g, (_match, i) => {
    return `<code class="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">${inlineCodes[i]}</code>`;
  });

  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_match, i) => {
    return `<pre class="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto my-2"><code>${codeBlocks[i]}</code></pre>`;
  });

  html = html.replace(/<p class="mb-2"><\/p>/g, '');

  if (!html.startsWith('<')) {
    html = '<p class="mb-2">' + html + '</p>';
  }

  return html;
}
