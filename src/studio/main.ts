import { initEditor } from './editor';

const start = () => {
  // Destructive buttons ask first.
  document.querySelectorAll<HTMLFormElement>('form[data-confirm]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    })
  );
  const editor = document.querySelector<HTMLFormElement>('[data-editor]');
  if (editor) initEditor(editor);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
