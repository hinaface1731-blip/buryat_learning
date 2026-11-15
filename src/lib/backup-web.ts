// Вызывается только по нажатию кнопок в веб-версии.
export function downloadBackup(data: string, day: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'buryat-progress-' + day + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function chooseBackup(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > 10 * 1024 * 1024) return reject(new Error('Файл слишком большой. Максимум — 10 МБ.'));
      try { resolve(await file.text()); } catch { reject(new Error('Не удалось прочитать файл.')); }
    };
    input.click();
  });
}
