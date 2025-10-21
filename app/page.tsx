"use client";
import { useEffect, useState } from "react";

type Row = {
  asin:string; title:string; brand:string; bsr:number|null; bsr_category:string|null;
  rating:number|null; reviews_count:number|null; price_cents:number|null; url:string; last_seen:string;
};

export default function Home() {
  const [rows,setRows] = useState<Row[]>([]);
  const [q,setQ] = useState("");
  async function load() {
    const r = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=100`);
    setRows(await r.json());
  }
  useEffect(()=>{ load(); },[]);
  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 w-80" placeholder="Filter by title or brand" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="border rounded px-4 py-2" onClick={load}>Refresh</button>
      </div>
      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">ASIN</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Brand</th>
              <th className="p-2 text-left">BSR</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Rating</th>
              <th className="p-2 text-left">Reviews</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.asin} className="border-t">
                <td className="p-2"><a className="underline" href={r.url} target="_blank" rel="noreferrer">{r.asin}</a></td>
                <td className="p-2">{r.title}</td>
                <td className="p-2">{r.brand}</td>
                <td className="p-2">{r.bsr ?? ""}</td>
                <td className="p-2">{r.bsr_category ?? ""}</td>
                <td className="p-2">{r.rating ?? ""}</td>
                <td className="p-2">{r.reviews_count ?? ""}</td>
                <td className="p-2">{r.price_cents!=null ? `$${(r.price_cents/100).toFixed(2)}` : ""}</td>
                <td className="p-2">{new Date(r.last_seen).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
