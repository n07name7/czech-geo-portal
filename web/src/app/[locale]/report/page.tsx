import type { Metadata } from "next";
import ClientPage from "./ClientPage";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const address = typeof sp.address === "string" ? sp.address : null;
  const title = address ? `${address} | Kam v Česku?` : "Report | Kam v Česku?";
  
  if (!address) {
    return { title };
  }

  // Create a dynamic OG image URL
  const ogUrl = new URL(`https://kamvcesku.cz/api/og`);
  ogUrl.searchParams.set("address", address);
  
  return {
    title,
    openGraph: {
      title,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogUrl.toString()],
    },
  };
}

export default function Page() {
  return <ClientPage />;
}
