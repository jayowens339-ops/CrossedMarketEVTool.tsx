export const metadata = {
  title: "Crossed Market +EV Tool",
  description: "No-vig fair odds, crossed markets, EV & Kelly",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0a", color: "#e5e5e5", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
