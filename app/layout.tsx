export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <title>SPACE CLASS BANK · 우주 디지털 학급은행</title>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/html5-qrcode" defer></script>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
                background-color: #020617;
              }
              ::-webkit-scrollbar { width: 6px; height: 6px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.35); border-radius: 9999px; }
              ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.55); }
            `,
          }}
        />
      </head>
      <body className="bg-slate-950 text-white min-h-screen antialiased selection:bg-indigo-500/40 selection:text-white">
        {children}
      </body>
    </html>
  );
}
