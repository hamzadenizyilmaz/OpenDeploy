import "./globals.css";
import { ThemeBoot } from "../components/ThemeBoot";

export const metadata = {
  title: "OpenDeploy",
  description: "Open-source web control panel for modern JavaScript deployments"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
