import "./globals.css";

export const metadata = {
  title: "IMOUVIR CRM",
  description: "CRM operacional para pedidos de aparelhos auditivos da IMOUVIR."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
