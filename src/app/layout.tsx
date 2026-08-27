import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://z-crm.app";
const SITE_NAME = "Z-CRM";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Z-CRM — Omnichannel CRM & Business Management Suite for Bangladesh",
    template: "%s | Z-CRM",
  },
  description:
    "Z-CRM is the complete business management system for Bangladesh businesses. Manage orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce & Telegram — all in one place. Starting at only ৳500/week.",
  keywords: [
    "CRM Bangladesh",
    "CRM Dhaka",
    "business management software Bangladesh",
    "order management system",
    "inventory management Bangladesh",
    "WooCommerce CRM",
    "WhatsApp business CRM",
    "Telegram CRM bot",
    "profit and loss software",
    "accounting software Bangladesh",
    "POS system Bangladesh",
    "e-commerce CRM",
    "bKash payment management",
    "stock management system",
    "multi-channel sales management",
    "delivery management Bangladesh",
    "courier integration Pathao Steadfast",
    "small business CRM",
    "retail management software",
    "Z-CRM",
  ],
  authors: [{ name: "Z-CRM Team" }],
  creator: "Z-CRM",
  publisher: "Z-CRM",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Z-CRM — Omnichannel CRM & Business Management Suite for Bangladesh",
    description:
      "Manage orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce & Telegram — all in one place. Starting at only ৳500/week.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Z-CRM Omnichannel Business Suite Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Z-CRM — Omnichannel CRM for Bangladesh",
    description:
      "Manage orders, inventory, payments, WhatsApp, WooCommerce & Telegram in one system. Starting at ৳500/week.",
    images: ["/og-image.png"],
  },
  category: "Business Application",
  other: {
    "msapplication-TileColor": "#10b981",
  },
};

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Z-CRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Z-CRM is the complete omnichannel business management suite for Bangladesh. Manage orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce & Telegram — all in one place.",
  offers: [
    { "@type": "Offer", name: "Weekly", price: "500", priceCurrency: "BDT", description: "Weekly plan — ৳500/week" },
    { "@type": "Offer", name: "Monthly", price: "1800", priceCurrency: "BDT", description: "Monthly plan — ৳1,800/month" },
    { "@type": "Offer", name: "Yearly", price: "18000", priceCurrency: "BDT", description: "Yearly plan — ৳18,000/year" },
    { "@type": "Offer", name: "Lifetime", price: "50000", priceCurrency: "BDT", description: "Lifetime — one-time payment ৳50,000" },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "127",
  },
  publisher: {
    "@type": "Organization",
    name: "Z-CRM",
    url: SITE_URL,
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Z-CRM",
  url: SITE_URL,
  description: "Omnichannel CRM & Business Management Suite for Bangladesh businesses.",
  areaServed: "Bangladesh",
  knowsLanguage: ["en", "bn"],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Z-CRM?",
      acceptedAnswer: { "@type": "Answer", text: "Z-CRM is a complete omnichannel business management suite that unifies orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce, and Telegram into one system. It is designed for Bangladesh businesses with support for bKash, Nagad, cash, and local courier integrations." },
    },
    {
      "@type": "Question",
      name: "How much does Z-CRM cost?",
      acceptedAnswer: { "@type": "Answer", text: "Z-CRM starts at only ৳500/week. We offer flexible pricing: ৳500/week, ৳1,800/month, ৳18,000/year, or a one-time lifetime payment of ৳50,000. The weekly plan is perfect for small businesses." },
    },
    {
      "@type": "Question",
      name: "Does Z-CRM support WooCommerce?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Z-CRM syncs orders and products from WooCommerce via REST API and webhooks. It remains independent from WordPress and runs on its own infrastructure." },
    },
    {
      "@type": "Question",
      name: "Does Z-CRM support WhatsApp and Telegram?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Z-CRM integrates with WhatsApp Business Cloud API for customer conversations and order creation. It also has a Telegram bot with group-based role permissions for quick operational access." },
    },
    {
      "@type": "Question",
      name: "Can I use Z-CRM for offline orders?",
      acceptedAnswer: { "@type": "Answer", text: "Absolutely. Z-CRM has a fast order creation screen for offline orders. Online and offline orders share the same inventory, accounting, and customer database." },
    },
    {
      "@type": "Question",
      name: "Is my financial data accurate?",
      acceptedAnswer: { "@type": "Answer", text: "Z-CRM uses Prisma Decimal for all money calculations — no floating-point errors. Order items store historical cost snapshots so historical profitability never changes when prices are updated." },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
