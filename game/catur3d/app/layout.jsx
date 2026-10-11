import "./globals.css";

export const metadata = {
  title: "Chess 3D — Interactive Board",
  description:
    "Interactive 3D chess game built with Next.js, React Three Fiber and chess.js. Play vs AI or local 2-player.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0e14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
