// app/layout.tsx
export const metadata = {
  title: "Crossed Market +EV Tool",
  description: "No-vig fair odds, crossed market scanner, and fixed-payout EV",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0a", color: "#e5e7eb", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
