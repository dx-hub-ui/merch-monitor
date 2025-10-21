"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  asin: string;
  title: string | null;
  brand: string | null;
  image_url: string | null;
  bullet1: string | null;
  bullet2: string | null;
  merch_flag_source: string | null;
  bsr: number | null;
  bsr_category: string | null;
  rating: number | null;
  reviews_count: number | null;
  price_cents: number | null;
  url: string;
  last_seen: string;
};

const styles = `
.page { padding: 20px; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; min-width: 320px; }
.select, .btn { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; }
.grid { display: grid; grid-template-columns: 120px 1.1fr 0.9fr 120px 2fr 2fr 90px 90px 70px 90px 170px; gap: 8px; align-items: start; }
.header { position: sticky; top: 0; background: #f9fafb; padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
.cell { padding: 8px; border-bottom: 1px solid #f1f5f9; }
.card { display: contents; }
.badge { display: inline-block; font-size: 12px; padding: 2px 6px; border-radius: 999px; border: 1px solid #94a3b8; color: #334155; background: #f1f5f9; }
.img { width: 96px; height: 96px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.trunc { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.table { overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
.footer { margin-top: 8px; color: #6b7280; font-size: 12px; }
.link { color: #2563eb; text-decoration: none; }
.link:hover { text-decoration: underline; }
`;

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"bsr" | "reviews" | "rating" | "last_seen">("bsr");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [withImg, setWithImg] = useState(false);

  async function load() {
    const r = await fetch(`/api/products?q=${encodeURIComponent(q)}&sort=${sort}&dir=${dir}&limit=150`, { cache: "no-store" });
    let data: unknown;
    try { data = await r.json(); } catch { data = []; }
    if (!Array.isArray(data)) {
      console.error("API error payload:", data);
      setRows([]);
      return;
    }
    setRows(data as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(
    () => rows.filter(r => (withImg ? !!r.image_url : true)),
    [rows, withImg]
  );

  function fmtPrice(cents: number | null) {
    if (cents == null) return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="toolbar">
        <input className="input" placeholder="Filter by title or brand" value={q} onChange={e => setQ(e.target.value)} />
        <select className="select" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="bsr">Sort: BSR</option>
          <option value="reviews">Sort: Reviews</option>
          <option value="rating">Sort: Rating</option>
          <option value="last_seen">Sort: Last seen</option>
        </select>
        <select className="select" value={dir} onChange={e => setDir(e.target.value as any)}>
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={withImg} onChange={e => setWithImg(e.target.checked)} />
          with image
        </label>
        <button className="btn" onClick={load}>Refresh</button>
      </div>

      <div className="table">
        <div className="grid" style={{ minWidth: 1100 }}>
          <div className="header">Image</div>
          <div className="header">Title</div>
          <div className="header">Brand</div>
          <div className="header">ASIN</div>
          <div className="header">Bullet 1</div>
          <div className="header">Bullet 2</div>
          <div className="header">BSR</div>
          <div className="header">Reviews</div>
          <div className="header">Rating</div>
          <div className="header">Price</div>
          <div className="header">Source / Last seen</div>

          {filtered.map(r => (
            <div key={r.asin} className="card">
              <div className="cell">
                {r.image_url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="img" src={r.image_url} alt={r.title || r.asin} loading="lazy" />
                  </a>
                ) : null}
              </div>
              <div className="cell">
                <a className="link" href={r.url} target="_blank" rel="noreferrer">{r.title || r.asin}</a>
                {r.bsr_category ? <div className="badge" style={{ marginTop: 6 }}>{r.bsr_category}</div> : null}
              </div>
              <div className="cell">{r.brand}</div>
              <div className="cell mono">{r.asin}</div>
              <div className="cell trunc">{r.bullet1}</div>
              <div className="cell trunc">{r.bullet2}</div>
              <div className="cell">{r.bsr ?? ""}</div>
              <div className="cell">{r.reviews_count ?? ""}</div>
              <div className="cell">{r.rating ?? ""}</div>
              <div className="cell">{fmtPrice(r.price_cents)}</div>
              <div className="cell">
                {r.merch_flag_source ? <span className="badge">{r.merch_flag_source}</span> : null}
                <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(r.last_seen).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="footer">
        {filtered.length} items • Sorting on server. Use filters then Refresh.
      </div>
    </div>
  );
}
