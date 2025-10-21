"use client";
import { useEffect, useState } from "react";

type Row = {
  asin: string;
  title: string;
  brand: string;
  image_url: string | null;
  bullet1: string | null;
  bullet2: string | null;
  bsr: number | null;
  bsr_category: string | null;
  rating: number | null;
  reviews_count: number | null;
  price_cents: number | null;
  url: string;
  last_seen: string;
};

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const r = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=100`);
    setRows(await r.json());
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2 items-center">
        <input
          className="border rounded px-3 py-2 w-96"
          placeholder="Filter by title or brand"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="border rounded px-4 py-2" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm align-top">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Image</th>
              <th className="p-2 text-left">Brand</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">ASIN</th>
              <th className="p-2 text-left">Bullet 1</th>
              <th className="p-2 text-left">Bullet 2</th>
              <th className="p-2 text-left">BSR</th>
              <th className="p-2 text-left">Reviews</th>
              <th className="p-2 text-left">Rating</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asin} className="border-t">
                <td className="p-2">
                  {r.image_url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.image_url}
                        alt={r.title || r.asin}
                        className="h-16 w-16 object-contain border rounded"
                        loading="lazy"
                      />
                    </a>
                  ) : null}
                </td>
                <td className="p-2">{r.brand}</td>
                <td className="p-2">
                  <a className="underline" href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                </td>
                <td className="p-2">{r.asin}</td>
                <td className="p-2 max-w-xs">{r.bullet1}</td>
                <td className="p-2 max-w-xs">{r.bullet2}</td>
                <td className="p-2">{r.bsr ?? ""}</td>
                <td className="p-2">{r.reviews_count ?? ""}</td>
                <td className="p-2">{r.rating ?? ""}</td>
                <td className="p-2">{r.price_cents != null ? `$${(r.price_cents / 100).toFixed(2)}` : ""}</td>
                <td className="p-2">{new Date(r.last_seen).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
