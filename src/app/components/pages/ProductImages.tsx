import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, AlertCircle, Image as ImageIcon, FolderOpen, RefreshCw,
  Search, UploadCloud, XCircle, Clock3, HardDrive, ScanSearch
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Product = {
  id: string;
  name: string | null;
  brand: string | null;
  barcode: string | null;
  weight: string | null;
  image_url: string | null;
  candidate_image_url: string | null;
  verification_status: string | null;
  data_review_status: string | null;
};
type QueueItem = {
  key: string;
  file: File;
  relativePath: string;
  product: Product | null;
  matchReason: string;
  status: "matched" | "unmatched" | "uploaded" | "failed";
  error?: string;
};
const BUCKET = "product-images";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const normalize = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/\.[a-z0-9]{2,5}$/i, "")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const bytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
const message = (error: any) => error?.message || "Unexpected error.";

async function makeWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const max = 600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create an image canvas.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.80));
    if (!blob) throw new Error("WebP conversion failed for this image.");
    if (blob.size > MAX_FILE_BYTES) throw new Error(`Optimized image is still larger than 2 MB (${bytes(blob.size)}).`);
    return blob;
  } finally {
    bitmap.close();
  }
}

function matchFile(file: File, products: Product[]) {
  const stem = file.name.replace(/\.[^.]+$/, "");
  const normalized = normalize(stem);
  const digits = stem.replace(/\D/g, "");
  if (digits.length >= 8) {
    const barcodeMatches = products.filter(p => p.barcode && p.barcode.replace(/\D/g, "") === digits);
    if (barcodeMatches.length === 1) return { product: barcodeMatches[0], reason: "Exact barcode" };
  }
  const idMatch = products.find(p => p.id.toLowerCase() === stem.toLowerCase());
  if (idMatch) return { product: idMatch, reason: "Exact catalogue UUID" };
  const exact = products.filter(p => {
    const keys = [p.name, [p.brand, p.name, p.weight].filter(Boolean).join(" "), [p.name, p.weight].filter(Boolean).join(" ")]
      .filter(Boolean).map(v => normalize(String(v)));
    return keys.includes(normalized);
  });
  if (exact.length === 1) return { product: exact[0], reason: "Exact product name" };
  if (exact.length > 1) return { product: null, reason: "Ambiguous exact name" };
  return { product: null, reason: "No safe automatic match" };
}

export function ProductImages() {
  const [products, setProducts] = useState<Product[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "uploaded">("all");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const folderInput = useRef<HTMLInputElement>(null);
  const [manualProduct, setManualProduct] = useState<Record<string, string>>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const all: Product[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("universal_products")
          .select("id,name,brand,barcode,weight,image_url,candidate_image_url,verification_status,data_review_status")
          .order("name").range(from, from + 999);
        if (error) throw error;
        all.push(...(data || []) as Product[]);
        if (!data || data.length < 1000) break;
      }
      setProducts(all);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const stats = useMemo(() => ({
    total: products.length,
    approved: products.filter(p => !!p.image_url).length,
    missing: products.filter(p => !p.image_url).length,
    matched: queue.filter(q => q.status === "matched").length,
    unmatched: queue.filter(q => q.status === "unmatched").length,
    uploaded: queue.filter(q => q.status === "uploaded").length,
  }), [products, queue]);

  const visibleQueue = useMemo(() => queue.filter(item => {
    const matchesFilter = filter === "all" || item.status === filter;
    const text = query.trim().toLowerCase();
    const matchesSearch = !text || [
      item.file.name, item.product?.name, item.product?.brand, item.product?.barcode
    ].some(value => String(value || "").toLowerCase().includes(text));
    return matchesFilter && matchesSearch;
  }), [queue, filter, query]);

  async function scanFolder(files: FileList | null) {
    if (!files?.length) return;
    setScanning(true);
    setNotice("");
    try {
      const imageFiles = Array.from(files).filter(file =>
        file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(file.name)
      );
      const next: QueueItem[] = imageFiles.map((file, index) => {
        const result = matchFile(file, products);
        return {
          key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          file,
          relativePath: (file as any).webkitRelativePath || file.name,
          product: result.product,
          matchReason: result.reason,
          status: result.product ? "matched" : "unmatched",
        };
      });
      setQueue(next);
      setNotice(`Scanned ${imageFiles.length.toLocaleString()} image files. ${next.filter(x => x.product).length.toLocaleString()} were safely matched. Unmatched files require manual assignment.`);
      setFilter("all");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setScanning(false);
      if (folderInput.current) folderInput.current.value = "";
    }
  }

  function assignProduct(key: string, productId: string) {
    const product = products.find(p => p.id === productId) || null;
    setQueue(current => current.map(item => item.key === key ? {
      ...item, product, status: product ? "matched" : "unmatched",
      matchReason: product ? "Manually assigned" : "No product selected", error: undefined
    } : item));
  }

  async function approveAndUpload(item: QueueItem) {
    if (!item.product) return;
    if (item.product.image_url && !window.confirm("This product already has a canonical image. Replace it with this image?")) return;
    setUploadingKey(item.key);
    setNotice("");
    try {
      const webp = await makeWebp(item.file);
      const objectPath = `${item.product.id}/main.webp`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, webp, {
        contentType: "image/webp", upsert: true, cacheControl: "31536000"
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      const { error: updateError } = await supabase.from("universal_products").update({
        image_url: publicData.publicUrl,
        candidate_image_url: null,
        verification_status: "approved",
        data_review_status: "approved"
      }).eq("id", item.product.id);
      if (updateError) throw updateError;
      setQueue(current => current.map(row => row.key === item.key ? { ...row, status: "uploaded", error: undefined } : row));
      setProducts(current => current.map(p => p.id === item.product!.id ? {
        ...p, image_url: publicData.publicUrl, candidate_image_url: null,
        verification_status: "approved", data_review_status: "approved"
      } : p));
      setNotice(`Approved and uploaded ${item.file.name} (${bytes(webp.size)} WebP).`);
    } catch (error) {
      setQueue(current => current.map(row => row.key === item.key ? { ...row, error: message(error) } : row));
      setNotice(`Upload failed for ${item.file.name}: ${message(error)}`);
    } finally {
      setUploadingKey(null);
    }
  }

  return <section className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">RivoCity Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Product Image Manager</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Scan your local product-image folder, match files to the shared catalogue, preview, optimize to WebP and upload approved images only.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => void loadProducts()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button>
        <button onClick={() => folderInput.current?.click()} disabled={loading || scanning} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><FolderOpen size={16}/> {scanning ? "Scanning…" : "Select image folder"}</button>
        <input ref={folderInput} type="file" accept="image/*" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} onChange={e => void scanFolder(e.target.files)}/>
      </div>
    </header>

    {notice && <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{notice}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Master products", stats.total, PackageIcon],
        ["Approved images", stats.approved, CheckCircle2],
        ["Missing images", stats.missing, ImageIcon],
        ["Local files matched", stats.matched, ScanSearch],
      ].map(([label, value, Icon]: any) => <div key={label} className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between text-xs text-slate-500"><span>{label}</span><Icon size={17} className="text-emerald-600"/></div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{Number(value).toLocaleString()}</div>
      </div>)}
    </div>

    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <div className="flex items-center gap-2 font-semibold"><HardDrive size={17}/> Local-first image processing</div>
      <p className="mt-1 text-xs leading-5">Original files stay on your computer. Images are resized to a maximum 600 × 600 px and converted to WebP at 80% quality only when you approve an upload. Maximum uploaded file size: 2 MB. This page does not upload the selected folder automatically.</p>
    </div>

    <div className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><h2 className="font-bold text-slate-900">Local image review queue</h2><p className="text-xs text-slate-500">{queue.length.toLocaleString()} scanned files · {stats.uploaded} uploaded in this session · {stats.unmatched} unmatched</p></div>
        <div className="flex flex-wrap gap-2">
          {(["all", "matched", "unmatched", "uploaded"] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${filter === value ? "bg-emerald-600 text-white" : "border text-slate-600"}`}>{value}</button>)}
        </div>
      </div>
      <div className="flex gap-2 border-b p-3">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search filename, product, brand or barcode" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"/></div>
      </div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading shared catalogue…</div> :
       visibleQueue.length === 0 ? <div className="p-10 text-center"><ImageIcon className="mx-auto text-slate-300" size={28}/><p className="mt-2 text-sm font-semibold text-slate-700">No files in this view</p><p className="mt-1 text-xs text-slate-500">Select your _REVIEW_REQUIRED folder to scan local images.</p></div> :
       <div className="divide-y">{visibleQueue.map(item => <div key={item.key} className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-50"><img src={URL.createObjectURL(item.file)} alt="" className="h-full w-full object-contain" /></div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.file.name}</p><p className="truncate text-xs text-slate-500">{item.relativePath}</p><p className="text-[11px] text-slate-400">{bytes(item.file.size)} · {item.matchReason}</p>{item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:w-[44%]">
          <select value={item.product?.id || manualProduct[item.key] || ""} onChange={e => {setManualProduct(v => ({...v,[item.key]:e.target.value}));assignProduct(item.key,e.target.value);}} className="min-w-0 flex-1 rounded-lg border p-2 text-xs">
            <option value="">Choose matching catalogue product…</option>
            {products.filter(p => !p.image_url || p.id === item.product?.id).map(p => <option key={p.id} value={p.id}>{p.name} {p.brand ? `— ${p.brand}` : ""} {p.barcode ? `· ${p.barcode}` : ""}</option>)}
          </select>
          {item.status === "uploaded" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15}/> Uploaded</span> :
           <button onClick={() => void approveAndUpload(item)} disabled={!item.product || uploadingKey !== null} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{uploadingKey === item.key ? <RefreshCw size={14} className="animate-spin"/> : <UploadCloud size={14}/>} Approve & upload</button>}
        </div>
       </div>)}</div>}
    </div>
    <p className="text-xs text-slate-500">Automatic matching is deliberately conservative: barcode, catalogue UUID or exact normalized product name only. Uncertain files stay unmatched for manual assignment. Uploads replace the product's single canonical image at <code className="rounded bg-slate-100 px-1">product-images/&lt;product-id&gt;/main.webp</code>.</p>
  </section>;
}

function PackageIcon(props: any) {
  return <ImageIcon {...props}/>;
}
