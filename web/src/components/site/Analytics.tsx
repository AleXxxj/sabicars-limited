import Script from "next/script";

/**
 * Google Analytics, on the same property as the legacy site (set up
 * 2026-10-19), so visitor numbers carry across the switch instead of starting
 * again. Only the live site counts: local development and Vercel previews would
 * pollute the figures. Google's advertising features are refused before
 * anything is measured; the privacy notice describes exactly this.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-K5ZRJ8WNXW";

export function Analytics() {
  if (process.env.VERCEL_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
