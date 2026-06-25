export async function copyCodeToClipboard(text: string, toast: HTMLElement): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyCodeWithFallback(text);
    }
    showToast(toast, '代码已复制');
  } catch {
    try {
      copyCodeWithFallback(text);
      showToast(toast, '代码已复制');
    } catch {
      showToast(toast, '复制失败');
    }
  }
}

function copyCodeWithFallback(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function showToast(toast: HTMLElement, message: string): void {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1600);
}
