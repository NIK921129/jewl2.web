import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOVA — Modern Tech & Lifestyle Store" },
      {
        name: "description",
        content:
          "Shop headphones, wearables, computing gear and home essentials at NOVA. Free shipping, easy returns, secure checkout.",
      },
      { property: "og:title", content: "NOVA — Modern Tech & Lifestyle Store" },
      {
        property: "og:description",
        content: "Curated tech and lifestyle products with fast delivery and secure checkout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The real site is plain HTML/CSS/JS in /public (deployed to Vercel).
// This route just forwards the dev preview to it.
function Index() {
  useEffect(() => {
    window.location.replace("/index.html");
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Opening the store…
    </div>
  );
}
