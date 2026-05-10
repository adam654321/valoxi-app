import { Link, useParams } from "wouter";
import {
  getArticleBySlug,
  getArticlesByCategory,
  articles,
} from "@/data/helpContent";
import {
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
} from "lucide-react";

export default function HelpArticle() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Article not found
        </h1>
        <p className="text-muted-foreground mb-6">
          The help article you are looking for does not exist.
        </p>
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-[#e85d04] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>
      </div>
    );
  }

  const related = getArticlesByCategory(article.categoryId)
    .filter((a) => a.id !== article.id)
    .slice(0, 4);

  const categoryArticles = articles.filter(
    (a) => a.categoryId === article.categoryId
  );
  const currentIndex = categoryArticles.findIndex((a) => a.id === article.id);
  const prevArticle = currentIndex > 0 ? categoryArticles[currentIndex - 1] : null;
  const nextArticle =
    currentIndex < categoryArticles.length - 1
      ? categoryArticles[currentIndex + 1]
      : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/help" className="hover:text-[#e85d04] transition-colors">
          Help
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span>{article.category}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{article.title}</span>
      </nav>

      {/* Article header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[#e85d04] font-semibold mb-2">
          {article.category}
        </p>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {article.title}
        </h1>
        <p className="text-muted-foreground text-lg">{article.excerpt}</p>
      </div>

      {/* Article content */}
      <article className="space-y-5">
        {article.content.map((block, idx) => {
          switch (block.type) {
            case "heading":
              return (
                <h2
                  key={idx}
                  className="text-xl font-semibold text-foreground mt-8 mb-3"
                >
                  {block.text}
                </h2>
              );
            case "paragraph":
              return (
                <p key={idx} className="text-foreground/90 leading-relaxed">
                  {block.text}
                </p>
              );
            case "bullet":
              return (
                <ul key={idx} className="space-y-2">
                  {block.items?.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-foreground/90"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e85d04] mt-2 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              );
            case "numbered":
              return (
                <ol key={idx} className="space-y-3">
                  {block.items?.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-foreground/90"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#e85d04]/15 text-[#e85d04] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              );
            case "table":
              return (
                <div key={idx} className="overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                    {block.headers && (
                      <thead>
                        <tr className="bg-muted">
                          {block.headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-4 py-3 text-left text-foreground font-semibold border-b border-border"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody className="divide-y divide-border">
                      {block.rows?.map((row, ri) => (
                        <tr
                          key={ri}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          {row.cells.map((cell, ci) => (
                            <td
                              key={ci}
                              className="px-4 py-3 text-muted-foreground"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case "tip":
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-[#e85d04]/10 border border-[#e85d04]/20 rounded-lg p-4"
                >
                  <Lightbulb className="w-5 h-5 text-[#e85d04] shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{block.text}</p>
                </div>
              );
            case "warning":
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg p-4"
                >
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{block.text}</p>
                </div>
              );
            default:
              return null;
          }
        })}
      </article>

      {/* Feedback */}
      <div className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-muted-foreground mb-3">
          Was this article helpful?
        </p>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-[#e85d04]/10 hover:border-[#e85d04]/30 hover:text-[#e85d04] transition-colors">
            <CheckCircle2 className="w-4 h-4" />
            Yes, helpful
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors">
            <AlertCircle className="w-4 h-4" />
            Not helpful
          </button>
        </div>
      </div>

      {/* Prev/Next navigation */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prevArticle && (
          <Link
            href={`/help/article/${prevArticle.slug}`}
            className="group p-4 bg-card border border-border rounded-lg hover:border-[#e85d04]/30 transition-colors"
          >
            <p className="text-xs text-muted-foreground mb-1">Previous</p>
            <p className="text-sm font-medium text-foreground group-hover:text-[#e85d04] transition-colors">
              {prevArticle.title}
            </p>
          </Link>
        )}
        {nextArticle && (
          <Link
            href={`/help/article/${nextArticle.slug}`}
            className={`group p-4 bg-card border border-border rounded-lg hover:border-[#e85d04]/30 transition-colors ${
              !prevArticle ? "sm:col-start-2" : ""
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1 text-right">
              Next
            </p>
            <p className="text-sm font-medium text-foreground group-hover:text-[#e85d04] transition-colors text-right">
              {nextArticle.title}
            </p>
          </Link>
        )}
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Related Articles
          </h3>
          <div className="space-y-2">
            {related.map((a) => (
              <Link
                key={a.id}
                href={`/help/article/${a.slug}`}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-[#e85d04]/30 hover:bg-muted/50 transition-colors group"
              >
                <FileText className="w-4 h-4 text-muted-foreground group-hover:text-[#e85d04] transition-colors" />
                <span className="text-sm text-foreground group-hover:text-[#e85d04] transition-colors">
                  {a.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
