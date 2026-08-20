export const metadata = {
  title: "Totalizador de Pedidos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Totalizador",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#F7F2E9" }}>
        {children}
      </body>
    </html>
  );
}
