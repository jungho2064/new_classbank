export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/html5-qrcode" defer></script>
      </head>
      <body className="bg-slate-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
