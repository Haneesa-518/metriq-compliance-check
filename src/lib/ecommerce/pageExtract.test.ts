import { describe, expect, it } from "vitest";
import { extractProductPageData, hasUsefulProductInfo, productPageToText } from "./pageExtract.server";
import { UrlFetchError, validateProductUrl } from "./urlFetch.server";

const HTML = `<!doctype html><html><head>
<title>Sample Brand Atta 1 kg — Demo Shop</title>
<meta name="description" content="Stone-ground whole wheat atta, 1 kg pack." />
<meta property="og:image" content="/img/atta-pack.jpg" />
<script type="application/ld+json">{"@type":"Product","name":"Sample Brand Atta 1 kg","offers":{"price":"245","priceCurrency":"INR"}}</script>
<script>var tracking = 'noise';</script><style>.a{color:red}</style>
</head><body>
<nav>Home Cart Sign in</nav>
<h1>Sample Brand Atta 1 kg</h1>
<table><tr><th>Net quantity</th><td>1 kg</td></tr><tr><th>Country of Origin</th><td>India</td></tr></table>
<p>MRP: Rs. 245.00 inclusive of all taxes</p>
<img src="/img/atta-pack.jpg" /><img src="/img/logo.svg" />
<footer>© Demo Shop</footer></body></html>`;

describe("product URL validation", () => {
  it("rejects empty and malformed URLs", () => {
    expect(() => validateProductUrl("")).toThrow(UrlFetchError);
    expect(() => validateProductUrl("not a url")).toThrow(UrlFetchError);
  });

  it("rejects private / non-public hosts", () => {
    expect(() => validateProductUrl("http://localhost:8080/x")).toThrow(UrlFetchError);
    expect(() => validateProductUrl("http://192.168.1.4/product")).toThrow(UrlFetchError);
  });

  it("normalises a valid product URL", () => {
    expect(validateProductUrl("demo.example/shop/item?x=1#frag")).toBe(
      "https://demo.example/shop/item?x=1",
    );
  });
});

describe("product page extraction", () => {
  const page = extractProductPageData("https://demo.example/p/1", HTML);

  it("extracts title, description and specifications", () => {
    expect(page.title).toContain("Sample Brand Atta");
    expect(page.description).toContain("whole wheat");
    expect(page.specifications["Net quantity"]).toBe("1 kg");
    expect(page.specifications["Price"]).toContain("245");
  });

  it("strips scripts, styles, nav and footer noise", () => {
    expect(page.visibleText).not.toContain("tracking");
    expect(page.visibleText).not.toContain("color:red");
    expect(page.visibleText).not.toContain("Sign in");
    expect(page.visibleText).toContain("MRP");
  });

  it("collects product images and drops logos/sprites", () => {
    expect(page.imageUrls).toContain("https://demo.example/img/atta-pack.jpg");
    expect(page.imageUrls.some((u) => u.endsWith("logo.svg"))).toBe(false);
  });

  it("reports usable product information and produces compact text", () => {
    expect(hasUsefulProductInfo(page)).toBe(true);
    const text = productPageToText(page);
    expect(text).toContain("Product title:");
    expect(text).not.toContain("<html");
  });

  it("flags pages with insufficient product information", () => {
    const thin = extractProductPageData("https://demo.example/x", "<html><body></body></html>");
    expect(hasUsefulProductInfo(thin)).toBe(false);
  });
});
