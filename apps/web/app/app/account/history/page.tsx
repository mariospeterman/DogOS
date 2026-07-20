"use client";

import { Archive, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../../lib/api-client";

interface SearchResult {
  createdAt: string;
  excerpt: string;
  href: string;
  id: string;
  kind: string;
  title: string;
  workspace: string;
}

export default function HistoryPage() {
  const [query, setQuery] = useState("recall");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function search() {
    const response = await fetch(
      dogosApiUrl(`/v1/search?query=${encodeURIComponent(query)}&limit=12`),
      { cache: "no-store", headers: await dogosApiHeaders() },
    );
    setSearched(true);
    if (response.ok) {
      const body = (await response.json()) as { results: SearchResult[] };
      setResults(body.results);
    }
  }

  return (
    <AppShell
      title="History"
      eyebrow="Canonical timeline"
      action={
        <Link className="button secondary" href="/app/coach">
          Coach
        </Link>
      }
      wide
    >
      <section className="command-panel">
        <div>
          <p className="eyebrow">Search all evidence</p>
          <h2>Messages, memory, video, live sessions</h2>
          <p>
            DogOS history is searchable by workspace, but access stays scoped to
            the authenticated household.
          </p>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
            value={query}
          />
          <button className="button primary" onClick={() => void search()}>
            Search
          </button>
        </div>
      </section>

      <section className="glass-panel">
        <span className="panel-kicker">
          <Archive size={16} /> Results
        </span>
        {results.length === 0 ? (
          <div className="empty-state">
            <Sparkles size={22} />
            <strong>
              {searched ? "No matching records" : "Ready to search"}
            </strong>
            <p>
              Try the goal, a cue, a place, a concern, or a video observation.
            </p>
          </div>
        ) : (
          <div className="timeline-list">
            {results.map((result) => (
              <Link
                className="timeline-node link-node"
                href={result.href}
                key={result.id}
              >
                <Search size={18} />
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.workspace} · {result.kind} · {result.excerpt}
                  </small>
                </span>
                <time>{new Date(result.createdAt).toLocaleDateString()}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
