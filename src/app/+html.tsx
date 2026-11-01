// Learn more https://docs.expo.dev/router/reference/static-rendering/#root-html

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

// Корневой HTML веб-версии (output: static). Выполняется только в Node.js при сборке,
// браузерные API здесь недоступны.
export default function Root({ children }: { children: React.ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="ru" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="description" content="Бурятский язык с нуля: короткие уроки, серия дней, интервальные повторения." />
        <meta name="theme-color" content="#F5F1E8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0E181E" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Бурятский" />
        {/* Сайт лежит в подпапке GitHub Pages: тот же путь, что experiments.baseUrl в app.json. */}
        <link rel="manifest" href="/buryat_learning/manifest.json" />
        <link rel="apple-touch-icon" href="/buryat_learning/icon-192.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

// Фон до загрузки JS — без белой вспышки в тёмной теме.
const BACKGROUND = `
body { background-color: #F5F1E8; }
@media (prefers-color-scheme: dark) { body { background-color: #0E181E; } }
`;
