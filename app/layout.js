import "./globals.css";
import ClickGlow from "./ClickGlow";

export const metadata = {
  title: "ABRACADABRA",
  description: "Transactable art and clothing, one tap to buy.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ClickGlow />
      </body>
    </html>
  );
}
