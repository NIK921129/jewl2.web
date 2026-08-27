import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

// The storefront is a plain HTML/CSS/JS app living in /public (index.html).
// Vercel serves it at "/" directly. Inside this dev preview the framework
// owns "/", so we hand the visitor straight over to the static store.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOVA — Fine Jewellery Store" },
      {
        name: "description",
        content:
          "NOVA is a full commerce storefront with cart, checkout, coupons and an admin control center.",
      },
      { property: "og:title", content: "NOVA — Fine Jewellery Store" },
      {
        property: "og:description",
        content: "Shop the NOVA collection: necklaces, rings, earrings and bracelets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/index.html");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Opening the store…</p>
    </div>
  );
}
