import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, PackageSearch, Plus, RefreshCw, Search, X, Save, Trash2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type MasterProduct = { id:string; name:string|null; brand:string|null; category_id:string|null; barcode:string|null; manufacturer:string|null; unit:string|null; weight:string|null; image_url:string|null; status:string|null };
type Alias = { id:string; universal_product_id:string; alias:string };
type Category = { id:string; name:string };
type MasterImage = { id:string; universal_product_id:string; image_url:string; is_primary:boolean; source:string };

const blank = {name:"",brand:"",category_id:"",barcode:"",manufacturer:"",unit:"",weight:"",status:"active"};
const errorText = (e:any) => e?.message || "Something went wrong.";

export function ProductCatalogue() {
 const [rows,setRows]=useState<MasterProduct[]>([]);
 const [aliases,setAliases]=useState<Alias[]>([]);
 const [images,setImages]=useState<MasterImage[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const [editing,setEditing]=useState<MasterProduct|null>(null);
 const [form,setForm]=useState(blank);
 const [aliasText,setAliasText]=useState("");
 const [file,setFile]=useState<File|null>(null);

 const load=useCallback(async()=>{
  setLoading(true); setNotice("");
  try {
   const [p,a,i,c]=await Promise.all([
    supabase.from("universal_products").select("id,name,brand,category_id,barcode,manufacturer,unit,weight,image_url,status").order("name"),
    supabase.from("universal_product_aliases").select("id,universal_product_id,alias").order("alias"),
    supabase.from("universal_product_images").select("id,universal_product_id,image_url,is_primary,source").order("created_at"),
    supabase.from("product_categories").select("id,name").eq("status","active").order("name")
   ]);
   if(p.error) throw p.error; if(a.error) throw a.error; if(i.error) throw i.error; if(c.error) throw c.error;
   setRows(p.data||[]); setAliases(a.data||[]); setImages(i.data||[]); setCategories(c.data||[]);
  } catch(e){setNotice(errorText(e));} finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const filtered=useMemo(()=>rows.filter(p=>{
  const q=query.toLowerCase().trim(); if(!q)return true;
  return [p.name,p.brand,p.barcode,...aliases.filter(a=>a.universal_product_id===p.id).map(a=>a.alias)].some(v=>(v||"").toLowerCase().includes(q));
 }),[rows,aliases,query]);

 function startNew(){setEditing(null);setForm(blank);setAliasText("");setFile(null);setNotice("");}
 function startEdit(p:MasterProduct){setEditing(p);setForm({name:p.name||"",brand:p.brand||"",category_id:p.category_id||"",barcode:p.barcode||"",manufacturer:p.manufacturer||"",unit:p.unit||"",weight:p.weight||"",status:p.status||"active"});setAliasText(aliases.filter(a=>a.universal_product_id===p.id).map(a=>a.alias).join("\n"));setFile(null);setNotice("");}

 async function save(e:React.FormEvent){
  e.preventDefault(); if(!form.name.trim())return;
  setSaving(true);setNotice("");
  let uploadedPath:string|null=null;
  try{
   const payload={name:form.name.trim(),brand:form.brand.trim()||null,category_id:form.category_id||null,barcode:form.barcode.trim()||null,manufacturer:form.manufacturer.trim()||null,unit:form.unit.trim()||null,weight:form.weight.trim()||null,status:form.status};
   let id=editing?.id;
   if(id){const {error}=await supabase.from("universal_products").update(payload).eq("id",id);if(error)throw error;}
   else{const {data,error}=await supabase.from("universal_products").insert(payload).select("id").single();if(error)throw error;id=data.id;}
   if(file){
    if(!file.type.startsWith("image/"))throw new Error("Select a valid image file.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    uploadedPath=`master-products/${id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from("product-images").upload(uploadedPath,file,{upsert:false,contentType:file.type,cacheControl:"31536000"});
    if(error)throw error;
    const url=supabase.storage.from("product-images").getPublicUrl(uploadedPath).data.publicUrl;
    const {error:imgError}=await supabase.from("universal_product_images").insert({universal_product_id:id,image_url:url,is_primary:true,source:"admin"});
    if(imgError)throw imgError;
   }
   const desired=[...new Set(aliasText.split("\n").map(s=>s.trim()).filter(Boolean))];
   const {data:old,error:oldErr}=await supabase.from("universal_product_aliases").select("id,alias").eq("universal_product_id",id);
   if(oldErr)throw oldErr;
   const desiredKeys=new Set(desired.map(s=>s.toLocaleLowerCase()));
   const remove=(old||[]).filter((a:any)=>!desiredKeys.has(String(a.alias).toLocaleLowerCase())).map((a:any)=>a.id);
   if(remove.length){const {error}=await supabase.from("universal_product_aliases").delete().in("id",remove);if(error)throw error;}
   const oldKeys=new Set((old||[]).map((a:any)=>String(a.alias).toLocaleLowerCase()));
   const add=desired.filter(s=>!oldKeys.has(s.toLocaleLowerCase())).map(alias=>({universal_product_id:id,alias}));
   if(add.length){const {error}=await supabase.from("universal_product_aliases").insert(add);if(error)throw error;}
   setNotice("Master product saved.");setEditing(null);setForm(blank);setAliasText("");setFile(null);await load();
  }catch(e){setNotice(errorText(e));}finally{setSaving(false);}
 }
 async function removeAlias(a:Alias){if(!window.confirm(`Delete alias "${a.alias}"?`))return;const {error}=await supabase.from("universal_product_aliases").delete().eq("id",a.id);if(error)setNotice(errorText(error));else await load();}

 return <section className="space-y-5">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">RivoCity Admin</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Master Product Catalogue</h1><p className="mt-1 text-sm text-slate-500">One shared identity and image set for each exact product variant. Vendor prices and stock stay separate.</p></div><button onClick={startNew} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white inline-flex gap-2 items-center"><Plus size={16}/> New master product</button></header>
  {notice&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</div>}
  <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Master products</div><div className="text-2xl font-bold">{rows.length}</div></div><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Aliases</div><div className="text-2xl font-bold">{aliases.length}</div></div><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Shared images</div><div className="text-2xl font-bold">{images.length}</div></div></div>
  <div className="rounded-xl border bg-white"><div className="flex gap-2 border-b p-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, brand, barcode or alias" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"/></div><button onClick={()=>void load()} className="rounded-lg border px-3 text-sm"><RefreshCw size={16}/></button></div>
   {loading?<div className="p-10 text-center text-sm text-slate-500">Loading catalogue…</div>:filtered.length===0?<div className="p-10 text-center text-sm text-slate-500">No master products yet. Add your first product to start.</div>:<div className="divide-y">{filtered.map(p=><div key={p.id} className="flex flex-wrap items-center gap-3 p-3"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-slate-50">{p.image_url?<img src={p.image_url} className="h-full w-full object-contain" alt=""/>:<PackageSearch className="text-slate-300"/>}</div><div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{p.name||"Unnamed product"} {p.weight&&<span className="text-xs font-normal text-slate-500">{p.weight}</span>}</div><div className="text-xs text-slate-500">{p.brand||"No brand"} · {aliases.filter(a=>a.universal_product_id===p.id).length} aliases · {images.filter(i=>i.universal_product_id===p.id).length} images</div></div><button onClick={()=>startEdit(p)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Manage</button></div>)}</div>}
  </div>
  {(editing||form.name!==""||notice==="")&&<form onSubmit={save} className="rounded-xl border bg-white p-4 space-y-4">
   <div className="flex items-center justify-between"><h2 className="font-bold">{editing?"Edit selected master product":"Create master product"}</h2><button type="button" onClick={()=>{setEditing(null);setForm(blank);setAliasText("");setFile(null);}} className="text-xs text-slate-500">Clear form</button></div>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-medium text-slate-600">Exact product / variant name<input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Tata Salt 1 kg" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Brand<input value={form.brand} onChange={e=>setForm(v=>({...v,brand:e.target.value}))} placeholder="Tata" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Category<select value={form.category_id} onChange={e=>setForm(v=>({...v,category_id:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"><option value="">Unassigned</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-600">Barcode<input value={form.barcode} onChange={e=>setForm(v=>({...v,barcode:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Manufacturer<input value={form.manufacturer} onChange={e=>setForm(v=>({...v,manufacturer:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Unit<input value={form.unit} onChange={e=>setForm(v=>({...v,unit:e.target.value}))} placeholder="kg, g, litre, pcs" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Pack size / weight<input value={form.weight} onChange={e=>setForm(v=>({...v,weight:e.target.value}))} placeholder="1 kg" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
    <label className="text-xs font-medium text-slate-600">Status<select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label className="text-xs font-medium text-slate-600">Primary image<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-1 block w-full text-xs"/></label>
   </div>
   <label className="block text-xs font-medium text-slate-600">Aliases / alternate names — one per line<textarea rows={4} value={aliasText} onChange={e=>setAliasText(e.target.value)} placeholder={"Tata Namak 1kg\nTata Salt 1kg\nटाटा नमक 1 किलो"} className="mt-1 w-full rounded-lg border p-3 text-sm"/></label>
   <p className="text-xs text-slate-500">Create a separate master product for each pack size. Example: Tata Salt 500 g and Tata Salt 1 kg must have separate images and aliases.</p>
   <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving?"Saving…":"Save master product"}</button></div>
  </form>}
 </section>;
}
